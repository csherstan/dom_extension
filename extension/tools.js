// Identify section by visible text
const identifySectionByTextDefinition = {
  type: "function",
  function: {
    name: "identify_section_by_text",
    description: "Find the selector(s) for the DOM section(s) containing the given visible text.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The visible text to search for in the DOM."
        }
      },
      required: ["text"]
    }
  }
};
async function identifySectionByText(dom, { text }) {
  console.log(`[Tool] === identify_section_by_text START ===`);
  console.log(`[Tool] identify_section_by_text called with text: "${text}"`);
  console.log(`[Tool] identify_section_by_text received DOM length: ${(dom || '').length} chars`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(dom, "text/html");
  console.log(`[Tool] identify_section_by_text parsed DOM successfully`);
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null, false);
  let matches = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent && node.textContent.trim().includes(text)) {
      matches.push(node);
    }
  }
  // Filter to most relevant (deepest) nodes
  matches = matches.filter((el, idx, arr) =>
    !arr.some(other => other !== el && other.contains(el))
  );
  const selectors = matches.map(getUniqueSelector).filter(Boolean);

  const result = selectors.length
    ? `Selectors for section(s) containing "${text}":\n` + selectors.join('\n')
    : `No section found containing "${text}".`;

  console.log(`[Tool] identify_section_by_text result: Found ${selectors.length} selector(s)`);
  console.log(`[Tool] identify_section_by_text output:`, result);
  console.log(`[Tool] === identify_section_by_text END ===`);

  return result;
}

// Identify section by position
const identifySectionByPositionDefinition = {
  type: "function",
  function: {
    name: "identify_section_by_position",
    description: "Find the selector(s) for the DOM section at a given position (e.g. first header, second paragraph, nth element of a type).",
    parameters: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "The tag name to search for (e.g. 'h1', 'p', 'div')."
        },
        index: {
          type: "integer",
          description: "The 0-based index of the element among its siblings of the same tag."
        }
      },
      required: ["tag", "index"]
    }
  }
};
async function identifySectionByPosition(dom, { tag, index }) {
  console.log(`[Tool] === identify_section_by_position START ===`);
  console.log(`[Tool] identify_section_by_position called with tag: "${tag}", index: ${index}`);
  console.log(`[Tool] identify_section_by_position received DOM length: ${(dom || '').length} chars`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(dom, "text/html");
  const elements = Array.from(doc.getElementsByTagName(tag));

  console.log(`[Tool] identify_section_by_position: Found ${elements.length} <${tag}> elements`);

  let result;
  if (elements.length > index) {
    const selector = getUniqueSelector(elements[index]);
    result = selector
      ? `Selector for the ${index}th <${tag}>: ${selector}`
      : `Could not generate selector for the ${index}th <${tag}>.`;
  } else {
    result = `No <${tag}> element at index ${index}.`;
  }

  console.log(`[Tool] identify_section_by_position output:`, result);
  console.log(`[Tool] === identify_section_by_position END ===`);

  return result;
}

// Tool: Get the current DOM as HTML
const getDomDefinition = {
  type: "function",
  function: {
    name: "get_dom",
    description: "Get the current HTML DOM of the page as a string.",
    parameters: {
      type: "object",
      properties: {}
    }
  }
};
// Handler for get_dom: expects dom as first argument, but ignores it
async function getDom(dom, _params) {
  console.log(`[Tool] === get_dom START ===`);
  console.log(`[Tool] get_dom called`);
  console.log(`[Tool] get_dom: Returning DOM with length ${(dom || "").length} characters`);
  console.log(`[Tool] === get_dom END ===`);

  // Just return the dom argument
  return dom || "";
}

// Tool: Submit final CSS output
const finalOutputDefinition = {
  type: "function",
  function: {
    name: "final_output",
    description: "Submit the final CSS code to be applied to the page. Call this when you have generated the CSS and are ready to complete the task.",
    parameters: {
      type: "object",
      properties: {
        css: {
          type: "string",
          description: "The complete CSS code to apply to the page. Should be valid CSS without markdown code fences."
        }
      },
      required: ["css"]
    }
  }
};
async function finalOutput(dom, { css }) {
  console.log(`[Tool] === final_output START ===`);
  console.log(`[Tool] final_output called`);
  console.log(`[Tool] final_output received CSS length: ${(css || '').length} chars`);
  console.log(`[Tool] final_output CSS preview:`, css?.substring(0, 200));
  console.log(`[Tool] === final_output END ===`);

  // Return a special marker that background.js will recognize
  return `__FINAL_CSS__${css}`;
}

// Helper: Generate a unique CSS selector for an element
function getUniqueSelector(el) {
  if (!el) return null;
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el && el.nodeType === 1 && el.tagName.toLowerCase() !== 'html') {
    let selector = el.tagName.toLowerCase();
    if (el.className) {
      const classes = el.className.trim().split(/\s+/).join('.');
      selector += `.${classes}`;
    }
    const siblingIndex = Array.from(el.parentNode.children)
      .filter(e => e.tagName === el.tagName)
      .indexOf(el);
    if (siblingIndex > 0) {
      selector += `:nth-of-type(${siblingIndex + 1})`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.length ? path.join(' > ') : null;
}

// Map of all tools by name
export const toolsMap = {
  identify_section_by_text: {
    definition: identifySectionByTextDefinition,
    handler: identifySectionByText
  },
  identify_section_by_position: {
    definition: identifySectionByPositionDefinition,
    handler: identifySectionByPosition
  },
  get_dom: {
    definition: getDomDefinition,
    handler: getDom
  },
  final_output: {
    definition: finalOutputDefinition,
    handler: finalOutput
  }
};

// Array of all tool definitions for LLM API
export const toolDefinitions = Object.values(toolsMap).map(t => t.definition);
