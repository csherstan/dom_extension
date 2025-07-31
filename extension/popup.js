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
    const outputEl = document.getElementById('output');
    outputEl.textContent = 'Saving CSS...';
    try {
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        outputEl.textContent = 'No active tab found.';
        return;
      }
      const url = new URL(tab.url).origin;
      // Fetch the injected CSS from the page
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const style = document.getElementById('__ollama_css');
          return style ? style.textContent : null;
        }
      }).then(([result]) => {
        const css = result.result;
        if (!css) {
          outputEl.textContent = 'No injected CSS found to save.';
          return;
        }
        chrome.storage.local.set({ [url]: css }, () => {
          outputEl.textContent = 'CSS saved for this site!';
        });
      }).catch(err => {
        outputEl.textContent = `Error fetching injected CSS: ${err.message}`;
      });
    } catch (err) {
      outputEl.textContent = `Error saving CSS: ${err.message}`;
    }
  });

  document.getElementById('applyChanges').addEventListener('click', async () => {
    const outputEl = document.getElementById('output');
    outputEl.textContent = 'Applying changes...';
    try {
      const instruction = document.getElementById('instruction').value;
      if (!instruction.trim()) {
        outputEl.textContent = 'Please enter an instruction.';
        return;
      }
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        outputEl.textContent = 'No active tab found.';
        return;
      }

      const model = document.getElementById('modelSelect').value;

      // Get the full DOM from the content script, but remove injected CSS first
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Clone the document to avoid modifying the live DOM
          const docClone = document.documentElement.cloneNode(true);
          const style = docClone.querySelector('style#__ollama_css');
          if (style) style.remove();
          // Serialize the clone to HTML
          return '<!DOCTYPE html>\n' + docClone.outerHTML;
        }
      }).then(([result]) => {
        let dom = result.result;
        // Clean the HTML using DOMPurify before sending to LLM
        if (window.DOMPurify) {
          dom = window.DOMPurify.sanitize(dom, {
            ALLOWED_TAGS: [
              'html', 'head', 'body', 'div', 'span', 'p', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'button', 'input', 'form', 'label', 'section', 'article', 'nav', 'footer', 'header', 'main', 'em', 'strong', 'b', 'i', 'u', 'br', 'hr', 'pre', 'code', 'select', 'option', 'textarea', 'svg', 'path', 'circle', 'rect', 'g', 'text', 'small', 'sup', 'sub', 'video', 'audio', 'source', 'figure', 'figcaption', 'blockquote', 'cite', 'dl', 'dt', 'dd', 'details', 'summary', 'mark', 'time', 'abbr', 'data', 'kbd', 'samp', 'var', 'wbr', 'col', 'colgroup', 'caption', 'tbody', 'tfoot', 'thead', 'track', 'map', 'area', 'canvas', 'meter', 'output', 'progress', 'template', 'datalist', 'fieldset', 'legend', 'optgroup', 'picture', 'portal', 'slot', 'noscript'
            ],
            ALLOWED_ATTR: [
              'id', 'class', 'href', 'src', 'alt', 'title', 'type', 'value', 'name', 'placeholder', 'role', 'aria-*', 'tabindex', 'style', 'width', 'height', 'colspan', 'rowspan', 'data-*'
            ],
            RETURN_DOM: false
          });
        }
        lastCleanedDom = dom;
        chrome.runtime.sendMessage(
          { type: "applyOllama", instruction, dom, tabId: tab.id , model},
          (response) => {
            if (chrome.runtime.lastError) {
              outputEl.textContent = `Runtime error: ${chrome.runtime.lastError.message}`;
              return;
            }
            if (response?.error) {
              outputEl.textContent = `Error: ${response.error}`;
            } else {
              const llmOutput = response.llmOutput || "";
              outputEl.textContent = "CSS applied!\n\nLLM Output:\n" + llmOutput;

              // Validate and apply CSS if present in LLM output
              const cssMatch = llmOutput.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
              if (cssMatch && cssMatch[1]) {
                const css = cssMatch[1];
                // Apply the CSS to the page
                chrome.scripting.insertCSS({
                  target: { tabId: tab.id },
                  css: css
                }).then(() => {
                  outputEl.textContent += "\n\nCSS successfully applied from LLM output.";
                }).catch(err => {
                  outputEl.textContent += `\n\nError applying CSS from LLM output: ${err.message}`;
                });
              } else {
                outputEl.textContent += "\n\nNo valid CSS found in LLM output.";
              }
            }
          }
        );
      }).catch(err => {
        outputEl.textContent = `Error extracting DOM: ${err.message}`;
      });
    } catch (err) {
      outputEl.textContent = `Unexpected error: ${err.message}`;
    }
  });

  // Save Cleaned DOM button handler
  let lastCleanedDom = '';
  document.getElementById('saveCleanedDomBtn').addEventListener('click', () => {
    if (!lastCleanedDom) {
      alert('No cleaned DOM available. Please apply changes first.');
      return;
    }
    const blob = new Blob([lastCleanedDom], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleaned_dom.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });

  // Handle enable/disable toggle for saved CSS
  let currentOrigin = null;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.url) return;
    currentOrigin = new URL(tab.url).origin;
    chrome.storage.local.get([currentOrigin + '_enabled'], (result) => {
      const enabled = result[currentOrigin + '_enabled'];
      const toggle = document.getElementById('toggleCss');
      toggle.checked = enabled !== false; // default to enabled
    });
  });

  document.getElementById('toggleCss').addEventListener('change', function (e) {
    if (!currentOrigin) return;
    const enabled = e.target.checked;
    chrome.storage.local.set({ [currentOrigin + '_enabled']: enabled }, () => {
      const outputEl = document.getElementById('output');
      outputEl.textContent = enabled
        ? 'Saved CSS enabled for this site.'
        : 'Saved CSS disabled for this site.';
      // Notify content script to update CSS immediately
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) return;
        chrome.tabs.sendMessage(tab.id, { type: "updateSavedCSS" });
      });
    });
  });

  // Open options page when "Manage all saved CSS" is clicked
  document.getElementById('manageCssLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  });
});