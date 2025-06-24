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
    const { instruction, dom, tabId, model} = message;
    const prompt = `Given the following HTML DOM:\n${dom}\n\n` +
      `And this instruction: "${instruction}"\n\n` +
      `Your task:\n` +
      `- Only generate CSS selectors for elements, classes, or IDs that actually exist in the provided DOM. Do not invent or hallucinate selectors.\n` +
      `- Do not use classes or IDs that are not present in the DOM.\n` +
      `- Return only a single code block with the CSS, and nothing else. Do not include any explanations or extra text.\n` +
      `- The output format must be:\n` +
      "```css\n/* CSS here */\n```\n";

    fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const css = extractCSS(data.response);
        if (!css) {
          sendResponse({ error: "No valid CSS code block found in LLM output." });
          return;
        }
        if (!isValidCSS(css)) {
          sendResponse({ error: "Extracted CSS appears invalid or empty." });
          return;
        }
        chrome.scripting.executeScript({
          target: { tabId },
          func: (css) => {
            // Remove previously injected style if it exists
            const prev = document.getElementById('__ollama_css');
            if (prev) prev.remove();
            // Inject new style
            let style = document.createElement('style');
            style.id = '__ollama_css';
            style.textContent = css;
            document.head.appendChild(style);
          },
          args: [css]
        });
        sendResponse({ success: true, llmOutput: data.response });
      })
      .catch(err => {
        sendResponse({ error: err.message });
      });

    return true;
  }
});
