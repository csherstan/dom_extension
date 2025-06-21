document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('testBtn').addEventListener('click', async () => {
    document.getElementById('output').textContent = 'Requesting background fetch...';

    chrome.runtime.sendMessage({ type: "testOllama" }, (response) => {
      if (chrome.runtime.lastError) {
        document.getElementById('output').textContent = `Runtime error: ${chrome.runtime.lastError.message}`;
        return;
      }

      if (response?.error) {
        document.getElementById('output').textContent = `Error: ${response.error}`;
      } else {
        document.getElementById('output').textContent = response.data;
      }
    });
  });

  document.getElementById('applyChanges').addEventListener('click', async () => {
    const instruction = document.getElementById('instruction').value;
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Get the full DOM from the content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML
    }).then(([result]) => {
      const dom = result.result;
      chrome.runtime.sendMessage(
        { type: "applyOllama", instruction, dom, tabId: tab.id },
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