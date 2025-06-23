console.log('Content script loaded!');

chrome.storage.local.get([location.origin], (result) => {
  const css = result[location.origin];
  if (css) {
    let style = document.getElementById('__ollama_css');
    if (!style) {
      style = document.createElement('style');
      style.id = '__ollama_css';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
});