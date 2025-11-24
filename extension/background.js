import { toolsMap, toolDefinitions } from './tools.js';
function extractCSS(text) {
  if (!text) return null;

  // Strategy 1: Standard markdown ```css ... ```
  let matches = [...text.matchAll(/```css\s*([\s\S]*?)```/gi)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1].trim() || null;
  }

  // Strategy 2: Any markdown code block ``` ... ``` that looks like CSS
  matches = [...text.matchAll(/```\s*([\s\S]*?)```/gi)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const content = matches[i][1].trim();
    // Check if it looks like CSS (has selector patterns with braces)
    if (/[a-z#.\-\[\]:*]+\s*\{[\s\S]*?\}/i.test(content)) {
      return content;
    }
  }

  // Strategy 3: CSS wrapped in <style> tags
  matches = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1].trim() || null;
  }

  // Strategy 4: Plain text CSS (no fences) - look for CSS-like patterns
  // Match multiple selector+rules blocks
  const cssPattern = /(?:^|[\r\n])([a-z#.\-\[\]:*][a-z0-9#.\-\[\]:*\s>,+~()]*)\s*\{([^}]+)\}/gim;
  matches = [...text.matchAll(cssPattern)];
  if (matches.length > 0) {
    // Combine all matched CSS rules
    return matches.map(m => m[0].trim()).join('\n\n');
  }

  // Strategy 5: JSON-wrapped CSS (some models wrap in JSON)
  try {
    const jsonMatch = text.match(/\{[\s\S]*"css"[\s\S]*:[\s\S]*"([\s\S]*?)"[\s\S]*\}/i);
    if (jsonMatch) {
      // Unescape JSON string
      return jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }
  } catch (e) {
    // Not valid JSON, continue
  }

  // Strategy 6: Remove common explanatory text and extract remaining CSS-like content
  let cleaned = text;
  // Remove common prefixes
  cleaned = cleaned.replace(/^(here'?s?\s+the\s+css:?|css\s+code:?|here\s+is|this\s+will)/gim, '');
  // Remove common suffixes
  cleaned = cleaned.replace(/(this\s+css\s+will|the\s+above\s+css|this\s+will)[\s\S]*$/gim, '');

  // Try to find CSS in the cleaned text
  matches = [...cleaned.matchAll(/([a-z#.\-\[\]:*][a-z0-9#.\-\[\]:*\s>,+~()]*)\s*\{([^}]+)\}/gim)];
  if (matches.length > 0) {
    return matches.map(m => m[0].trim()).join('\n\n');
  }

  return null;
}

function cleanCSS(css) {
  if (!css || typeof css !== 'string') return null;

  let cleaned = css;

  // 1. Remove explanatory comments in natural language (keep /* ... */ CSS comments)
  // Remove lines that look like natural language explanations
  cleaned = cleaned.split('\n').filter(line => {
    const trimmed = line.trim();
    // Keep empty lines, CSS comments, and lines with CSS syntax
    if (!trimmed || trimmed.startsWith('/*') || /[{}:;]/.test(trimmed)) {
      return true;
    }
    // Remove lines that look like English sentences (have spaces and no CSS syntax)
    if (/^[A-Z][a-z\s,]+[.!?]?\s*$/.test(trimmed)) {
      return false;
    }
    return true;
  }).join('\n');

  // 2. Remove common LLM wrapper patterns
  cleaned = cleaned.replace(/^css\s*\{([\s\S]*)\}$/m, '$1'); // Remove "css { ... }"
  cleaned = cleaned.replace(/^style\s*\{([\s\S]*)\}$/m, '$1'); // Remove "style { ... }"

  // 3. Fix unescaped quotes in property values
  cleaned = cleaned.replace(/(['"])([^'"]*)\1\s*:\s*([^;]+);/g, (_match, _quote, prop, value) => {
    // If value contains unescaped quotes, escape them
    const fixedValue = value.replace(/"/g, '\\"');
    return `${prop}: ${fixedValue};`;
  });

  // 4. Add missing semicolons at end of property declarations
  cleaned = cleaned.replace(/([a-z\-]+\s*:\s*[^;{}]+)(\s*})/gi, '$1;$2');

  // 5. Remove any accidentally included JavaScript
  const jsBlockPattern = /(?:function|const|let|var|if|for|while)\s*[({]/gi;
  cleaned = cleaned.replace(jsBlockPattern, '');

  // 6. Normalize whitespace
  cleaned = cleaned.replace(/\s*{\s*/g, ' {\n  '); // Opening brace formatting
  cleaned = cleaned.replace(/\s*}\s*/g, '\n}\n'); // Closing brace formatting
  cleaned = cleaned.replace(/\s*;\s*/g, ';\n  '); // Semicolon formatting
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove excessive blank lines

  // 7. Remove trailing commas (CSS doesn't use them like JSON)
  cleaned = cleaned.replace(/,(\s*})/g, '$1');

  // 8. Fix common property name mistakes
  const propertyFixes = {
    'background-colour': 'background-color',
    'colour': 'color',
    'font-weight: normal': 'font-weight: 400',
    'font-weight: bold': 'font-weight: 700'
  };
  for (const [wrong, right] of Object.entries(propertyFixes)) {
    cleaned = cleaned.replace(new RegExp(wrong, 'gi'), right);
  }

  return cleaned.trim() || null;
}

function sanitizeCSS(css) {
  // Remove potentially dangerous CSS patterns
  if (!css || typeof css !== 'string') return null;

  let sanitized = css;

  // 1. Block @import directives (can load external resources)
  sanitized = sanitized.replace(/@import\s+[^;]+;?/gi, '/* @import blocked for security */');

  // 2. Block @font-face with remote URLs (only allow data: URIs)
  sanitized = sanitized.replace(/@font-face\s*\{[^}]*url\s*\(\s*['"]?(?!data:)[^)]+\)[^}]*\}/gi,
    '/* @font-face with remote URL blocked */');

  // 3. Sanitize url() - only allow data: URIs, block http/https/javascript/etc
  sanitized = sanitized.replace(/url\s*\(\s*['"]?(?!data:)([^)'"]+)['"]?\s*\)/gi,
    (match, url) => {
      // Block non-data URLs
      if (/^(https?|ftp|file|javascript):/i.test(url.trim())) {
        return '/* url() blocked for security */';
      }
      return match; // Allow relative URLs and data: URIs
    });

  // 4. Remove IE-specific expression() (can execute JavaScript)
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '/* expression() blocked */');

  // 5. Remove -moz-binding (can execute XBL in old Firefox)
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]+;?/gi, '/* -moz-binding blocked */');

  // 6. Remove behavior property (IE-specific, can load HTC files)
  sanitized = sanitized.replace(/behavior\s*:[^;]+;?/gi, '/* behavior blocked */');

  // 7. Block javascript: URLs in any property
  sanitized = sanitized.replace(/javascript\s*:/gi, '/* javascript: blocked */');

  // 8. Remove any <script> tags that might have snuck in
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // 9. Block @namespace (rarely needed, can be used for obfuscation)
  sanitized = sanitized.replace(/@namespace\s+[^;]+;?/gi, '/* @namespace blocked */');

  return sanitized.trim() || null;
}

function extractPartialValidCSS(css) {
  // Try to salvage valid CSS rules from partially broken CSS
  if (!css || typeof css !== 'string') return null;

  const validRules = [];
  // Split on closing braces to get individual rules
  const potentialRules = css.split('}').filter(r => r.trim());

  for (const rule of potentialRules) {
    const withBrace = rule.trim() + '}';
    // Check if this individual rule looks valid using pattern matching
    // Must have: selector { property: value }
    if (/[^{]+\{[^}]*[a-z\-]+\s*:\s*[^;{}]+[^}]*\}/i.test(withBrace)) {
      validRules.push(withBrace);
    }
  }

  return validRules.length > 0 ? validRules.join('\n\n') : null;
}

function isValidCSS(css) {
  if (typeof css !== 'string' || !css.trim()) {
    return false;
  }

  // 1. Structure validation: check for balanced braces
  let braceCount = 0;
  for (const char of css) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount < 0) return false; // closing brace before opening
  }
  if (braceCount !== 0) return false; // unbalanced braces

  // 2. Must contain at least one valid-looking CSS rule
  const rulePattern = /[^{]+\{[^}]+\}/;
  if (!rulePattern.test(css)) {
    return false;
  }

  // 3. Check for valid CSS property patterns (property: value;)
  const propertyPattern = /[a-z\-]+\s*:\s*[^;{}]+/i;
  if (!propertyPattern.test(css)) {
    return false;
  }

  // 4. Reject if it looks like JavaScript or JSON
  const jsPatterns = [
    /\bfunction\s*\(/i,
    /\bconst\s+/i,
    /\blet\s+/i,
    /\bvar\s+/i,
    /\bconsole\./i,
    /=>/,
    /\bimport\s+/i,
    /\bexport\s+/i
  ];
  for (const pattern of jsPatterns) {
    if (pattern.test(css)) {
      return false;
    }
  }

  // All checks passed - CSS appears valid
  // Note: We can't use document.createElement in service worker context
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "applyOllama") {
    const { instruction, dom, tabId, model } = message;
    const systemPrompt = `You are a CSS generation assistant. When you finish using tools (or if you don't need tools), you MUST respond with ONLY valid CSS code inside a markdown code block.

CORRECT format:
\`\`\`css
body {
  background-color: blue;
}
\`\`\`

INCORRECT formats (do NOT use these):
- \`\`\`css\ncss { body { ... } }\n\`\`\`
- Including JSON or tool calls in your final response
- Adding explanations outside the code block

Your final response must contain ONLY the CSS code block, nothing else.`;

    // Compose chat history for MCP
    const chatHistory = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content:
          `HTML DOM:\n${dom}\n\n` +
          `Instruction: ${instruction}\n\n` +
          `Generate CSS that modifies the DOM according to the instruction. Use only selectors that exist in the provided DOM. ` +
          `Your response must be ONLY a code block starting with \`\`\`css and ending with \`\`\`.`
      }
    ];

    // Helper to send chat request to Ollama
    async function sendChat(history, tools) {
      const body = {
        model,
        messages: history,
        tools,
        stream: false
      };
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    // Main MCP loop
    (async () => {
      let history = [...chatHistory];
      let tools = toolDefinitions;
      let finalResponse = null;

      for (let i = 0; i < 3; ++i) { // up to 3 tool calls
        const data = await sendChat(history, tools);
        const msg = data.message || {};
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Only handle the first tool call for now
          const toolCall = msg.tool_calls[0];
          const toolEntry = toolsMap[toolCall.name];
          if (toolEntry && typeof toolEntry.handler === "function") {
            const params = toolCall.parameters || {};
            // Pass dom as first argument for all tools
            const output = await toolEntry.handler(dom, params);
            // Add tool call and result to history
            history.push({
              role: "assistant",
              content: "",
              tool_calls: [toolCall]
            });
            history.push({
              role: "tool",
              content: output,
              tool_call_id: toolCall.id
            });
            continue;
          }
        }
        // No tool calls, final response
        finalResponse = msg.content || data.message?.content || data.message?.response || "";
        console.log("[Ollama Extension] LLM final response:", finalResponse);
        break;
      }

      let css = extractCSS(finalResponse);
      console.log("[Ollama Extension] Extracted CSS (raw):", css);

      if (!css) {
        console.error("[Ollama Extension] No CSS found. Full response:", finalResponse);
        sendResponse({
          error: "No valid CSS code block found in LLM output.",
          llmOutput: finalResponse,
          rawOutput: finalResponse, // Allow user to see what was generated
          canRetry: true // Signal that retry might help
        });
        return;
      }

      // Clean the extracted CSS to fix common LLM mistakes
      const rawCSS = css; // Keep original for fallback
      css = cleanCSS(css);
      console.log("[Ollama Extension] Cleaned CSS:", css);

      // Sanitize CSS to remove dangerous patterns
      if (css) {
        css = sanitizeCSS(css);
        console.log("[Ollama Extension] Sanitized CSS:", css);
      }

      if (!css) {
        console.error("[Ollama Extension] CSS became empty after cleaning.");
        // Fallback: try using raw CSS if cleaning failed
        console.log("[Ollama Extension] Attempting fallback to raw CSS...");
        if (isValidCSS(rawCSS)) {
          console.log("[Ollama Extension] Raw CSS is valid, using it instead.");
          css = rawCSS;
        } else {
          sendResponse({
            error: "Extracted CSS was invalid and could not be repaired.",
            llmOutput: finalResponse,
            extractedCSS: rawCSS,
            canRetry: true
          });
          return;
        }
      }

      if (!isValidCSS(css)) {
        console.error("[Ollama Extension] CSS failed validation after cleaning.");

        // Fallback: Try to extract and apply individual valid rules
        const partialCSS = extractPartialValidCSS(css);
        if (partialCSS) {
          console.log("[Ollama Extension] Recovered partial valid CSS:", partialCSS);
          css = partialCSS;
          // Continue with partial CSS
        } else {
          sendResponse({
            error: "Extracted CSS appears invalid or empty.",
            llmOutput: finalResponse,
            extractedCSS: css,
            suggestion: "Try rephrasing your instruction or use a larger model.",
            canRetry: true
          });
          return;
        }
      }

      // Apply the CSS
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (css) => {
            const prev = document.getElementById('__ollama_css');
            if (prev) prev.remove();
            let style = document.createElement('style');
            style.id = '__ollama_css';
            style.textContent = css;
            document.head.appendChild(style);
          },
          args: [css]
        });
        sendResponse({
          success: true,
          llmOutput: finalResponse,
          appliedCSS: css
        });
      } catch (injectionError) {
        console.error("[Ollama Extension] Failed to inject CSS:", injectionError);
        sendResponse({
          error: `Failed to inject CSS: ${injectionError.message}`,
          llmOutput: finalResponse,
          extractedCSS: css
        });
      }
    })().catch(err => {
      sendResponse({ error: err.message });
    });

    return true;
  }
});
