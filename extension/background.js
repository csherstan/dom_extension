import { toolsMap, toolDefinitions } from './tools.js';
function extractCSS(text) {
  // Extract all CSS code blocks, return only the last one (assumed to be the LLM's output)
  const matches = [...text.matchAll(/```css\s*([\s\S]*?)```/gi)];
  if (matches.length === 0) return null;
  const lastBlock = matches[matches.length - 1][1].trim();
  return lastBlock || null;
}

function isValidCSS(css) {
  // Basic validation: not empty and contains at least one selector and property
  return typeof css === 'string' && /\{[^}]+\}/.test(css);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "applyOllama") {
    const { instruction, dom, tabId, model } = message;
    const systemPrompt = `You are a helpful assistant that can generate CSS for a given DOM and instruction, and can also use tools when needed.`;

    // Compose chat history for MCP
    const chatHistory = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content:
          `Given the following HTML DOM:\n${dom}\n\n` +
          `And this instruction: "${instruction}"\n\n` +
          `Your task:\n` +
          `- Only generate CSS selectors for elements, classes, or IDs that actually exist in the provided DOM. Do not invent or hallucinate selectors.\n` +
          `- Do not use classes or IDs that are not present in the DOM.\n` +
          `- Return only a single code block with the CSS, and nothing else. Do not include any explanations or extra text.\n` +
          `- The output format must be:\n` +
          "```css\n/* CSS here */\n```\n"
      }
    ];

    // Helper to send chat request to Ollama
    async function sendChat(history, tools, toolResults) {
      const body = {
        model,
        messages: history,
        tools,
        tool_results: toolResults,
        stream: false
      };
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    // Main MCP loop
    (async () => {
      let history = [...chatHistory];
      let toolResults = [];
      let tools = toolDefinitions;
      let finalResponse = null;

      for (let i = 0; i < 3; ++i) { // up to 3 tool calls
        const data = await sendChat(history, tools, toolResults);
        const msg = data.message || {};
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Only handle the first tool call for now
          const toolCall = msg.tool_calls[0];
          const toolEntry = toolsMap[toolCall.name];
          if (toolEntry && typeof toolEntry.handler === "function") {
            const params = toolCall.parameters || {};
            // Pass dom as first argument for all tools
            const output = await toolEntry.handler(dom, params);
            toolResults.push({
              call: toolCall,
              output
            });
            // Add tool call and result to history
            history.push({
              role: "assistant",
              content: "",
              tool_calls: [toolCall]
            });
            history.push({
              role: "tool",
              content: output,
              tool_call_id: toolCall.id
            });
            continue;
          }
        }
        // No tool calls, final response
        finalResponse = msg.content || data.message?.content || data.message?.response || "";
        break;
      }

      const css = extractCSS(finalResponse);
      if (!css) {
        sendResponse({ error: "No valid CSS code block found in LLM output.", llmOutput: finalResponse });
        return;
      }
      if (!isValidCSS(css)) {
        sendResponse({ error: "Extracted CSS appears invalid or empty.", llmOutput: finalResponse });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId },
        func: (css) => {
          const prev = document.getElementById('__ollama_css');
          if (prev) prev.remove();
          let style = document.createElement('style');
          style.id = '__ollama_css';
          style.textContent = css;
          document.head.appendChild(style);
        },
        args: [css]
      });
      sendResponse({ success: true, llmOutput: finalResponse });
    })().catch(err => {
      sendResponse({ error: err.message });
    });

    return true;
  }
});
