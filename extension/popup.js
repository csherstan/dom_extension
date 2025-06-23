document.addEventListener('DOMContentLoaded', function () {

  // Fetch models from Ollama and populate dropdown
  fetch('http://localhost:11434/api/tags')
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('modelSelect');
      if (data.models && Array.isArray(data.models)) {
        data.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          option.textContent = model.name;
          select.appendChild(option);
        });
      }
    })
    .catch(err => {
      const select = document.getElementById('modelSelect');
      select.innerHTML = `<option>Error loading models</option>`;
    });

  // Add this after DOMContentLoaded
  document.getElementById('saveCssBtn').addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const url = new URL(tab.url).origin;
    const output = document.getElementById('output').textContent;
    // Extract CSS from output (reuse extractCSS logic if needed)
    const css = output; // Or use your extractCSS function here
    chrome.storage.local.set({ [url]: css }, () => {
      document.getElementById('output').textContent = 'CSS saved for this site!';
    });
  });

  document.getElementById('applyChanges').addEventListener('click', async () => {
    const instruction = document.getElementById('instruction').value;
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const model = document.getElementById('modelSelect').value;

    // Get the full DOM from the content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML
    }).then(([result]) => {
      const dom = result.result;
      chrome.runtime.sendMessage(
        { type: "applyOllama", instruction, dom, tabId: tab.id , model},
        (response) => {
          if (chrome.runtime.lastError) {
            document.getElementById('output').textContent = `Runtime error: ${chrome.runtime.lastError.message}`;
            return;
          }
          if (response?.error) {
            document.getElementById('output').textContent = `Error: ${response.error}`;
          } else {
            document.getElementById('output').textContent = "CSS applied!\n\nLLM Output:\n" + (response.llmOutput || "");
          }
        }
      );
    });
  });
});