function extractCSS(text) {
  // Extract CSS between ```css ... ```
  const match = text.match(/```css\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  // Fallback: extract between <style> tags
  const styleMatch = text.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) return styleMatch[1].trim();
  // Fallback: return the whole text
  return text.trim();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "testOllama") {
    fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "codellama",
        prompt: "Write CSS to make all text green.",
        stream: false
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        sendResponse({ data: data.response });
      })
      .catch(err => {
        sendResponse({ error: err.message });
      });

    return true; // Required to indicate async response
  }

  if (message.type === "applyOllama") {
    const { instruction, dom, tabId } = message;
    const prompt = `Given the following HTML DOM:\n${dom}\n\nAnd this instruction: "${instruction}"\n\n
    
    Return only a code block with the CSS like:
        \`\`\`css
        /* CSS here */
        \`\`\`
        
        Do not include any explanation.
    `;

    fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "codellama",
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
        chrome.scripting.executeScript({
          target: { tabId },
          func: (css) => {
            let style = document.getElementById('__ollama_css');
            if (!style) {
              style = document.createElement('style');
              style.id = '__ollama_css';
              document.head.appendChild(style);
            }
            style.textContent = css;
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
