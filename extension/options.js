function isCSSKey(key) {
  return !key.endsWith('_enabled');
}

function renderList() {
  chrome.storage.local.get(null, (items) => {
    const cssList = document.getElementById('cssList');
    cssList.innerHTML = '';
    Object.entries(items)
      .filter(([key]) => isCSSKey(key))
      .forEach(([key, css]) => {
        const row = document.createElement('tr');
        row.className = 'css-row';

        // URL cell
        const urlCell = document.createElement('td');
        urlCell.className = 'css-url-cell';
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.value = key;
        urlInput.className = 'css-url-input';
        urlCell.appendChild(urlInput);

        // CSS cell
        const cssCell = document.createElement('td');
        cssCell.className = 'css-css-cell';
        const cssArea = document.createElement('textarea');
        cssArea.value = css;
        cssArea.className = 'css-css-area';
        cssCell.appendChild(cssArea);

        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'css-actions-cell';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete this rule';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = () => {
          row.remove();
        };
        actionsCell.appendChild(deleteBtn);

        row.appendChild(urlCell);
        row.appendChild(cssCell);
        row.appendChild(actionsCell);

        cssList.appendChild(row);
      });
  });
}

function showStatus(msg, isError) {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.style.color = isError ? '#dc2626' : '#2563eb';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  renderList();

  document.getElementById('addNew').onclick = () => {
    const cssList = document.getElementById('cssList');
    const row = document.createElement('tr');
    row.className = 'css-row';

    // URL cell
    const urlCell = document.createElement('td');
    urlCell.className = 'css-url-cell';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'Enter URL or pattern (e.g. https://example.com)';
    urlInput.className = 'css-url-input';
    urlCell.appendChild(urlInput);

    // CSS cell
    const cssCell = document.createElement('td');
    cssCell.className = 'css-css-cell';
    const cssArea = document.createElement('textarea');
    cssArea.placeholder = 'Enter CSS here...';
    cssArea.className = 'css-css-area';
    cssCell.appendChild(cssArea);

    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'css-actions-cell';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete this rule';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = () => {
      row.remove();
    };
    actionsCell.appendChild(deleteBtn);

    row.appendChild(urlCell);
    row.appendChild(cssCell);
    row.appendChild(actionsCell);

    cssList.appendChild(row);
    urlInput.focus();
  };

  document.getElementById('saveAll').onclick = () => {
    const cssList = document.getElementById('cssList');
    const rows = cssList.querySelectorAll('tr.css-row');
    const newEntries = {};
    let hasError = false;
    rows.forEach(row => {
      const urlInput = row.querySelector('.css-url-input');
      const cssArea = row.querySelector('.css-css-area');
      const url = urlInput.value.trim();
      if (!url) {
        urlInput.style.borderColor = '#dc2626';
        hasError = true;
        return;
      } else {
        urlInput.style.borderColor = '';
      }
      newEntries[url] = cssArea.value;
    });
    if (hasError) {
      showStatus('All URLs must be filled in.', true);
      return;
    }
    // Remove all old CSS keys, then set new ones
    chrome.storage.local.get(null, (items) => {
      const oldKeys = Object.keys(items).filter(isCSSKey);
      const toRemove = {};
      oldKeys.forEach(k => { toRemove[k] = null; });
      chrome.storage.local.remove(oldKeys, () => {
        chrome.storage.local.set(newEntries, () => {
          renderList();
          showStatus('All changes saved.');
        });
      });
    });
  };
});
