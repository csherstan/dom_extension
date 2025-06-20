document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('changeColor').addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.body.style.backgroundColor = '#FFDDC1';
      }
    }).catch(err => console.error('Script injection failed:', err));
  });
});
