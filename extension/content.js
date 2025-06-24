console.log('Content script loaded!');

function applyOrRemoveSavedCSS() {
  chrome.storage.local.get([location.origin, location.origin + '_enabled'], (result) => {
    const css = result[location.origin];
    const enabled = result[location.origin + '_enabled'];
    if (css && (enabled !== false)) {
      let style = document.getElementById('__ollama_css');
      if (!style) {
        style = document.createElement('style');
        style.id = '__ollama_css';
        document.head.appendChild(style);
      }
      style.textContent = css;
    } else {
      // Remove injected CSS if present and disabled
      let style = document.getElementById('__ollama_css');
      if (style) style.remove();
    }
  });
}

applyOrRemoveSavedCSS();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateSavedCSS") {
    applyOrRemoveSavedCSS();
  }
});