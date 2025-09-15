// Utility: get all visible text nodes under root
function getTextNodes(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      // ignore whitespace-only nodes
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      // ignore script/style or hidden elements
      let p = node.parentElement;
      while (p) {
        const style = window.getComputedStyle(p);
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}

function findTextRangeAcrossNodes(text) {
  // build concatenated string with node boundaries tracked
  const nodes = getTextNodes();
  if (nodes.length === 0) return null;

  const cumulative = [];
  let combined = "";
  for (let i = 0; i < nodes.length; i++) {
    const t = nodes[i].nodeValue;
    cumulative.push({
      node: nodes[i],
      start: combined.length,
      end: combined.length + t.length,
      text: t
    });
    combined += t;
  }

  const idx = combined.indexOf(text);
  if (idx === -1) return null;

  // find start node
  let startNodeInfo = null;
  let endNodeInfo = null;
  for (let i = 0; i < cumulative.length; i++) {
    const info = cumulative[i];
    if (idx >= info.start && idx < info.end) {
      startNodeInfo = {
        node: info.node,
        offset: idx - info.start
      };
    }
    const endIndex = idx + text.length - 1;
    if (endIndex >= info.start && endIndex < info.end) {
      endNodeInfo = {
        node: info.node,
        offset: endIndex - info.start + 1 // range end is exclusive
      };
      break;
    }
  }

  if (!startNodeInfo || !endNodeInfo) return null;

  const range = document.createRange();
  range.setStart(startNodeInfo.node, startNodeInfo.offset);
  range.setEnd(endNodeInfo.node, endNodeInfo.offset);
  return range;
}

function alreadyHasHighlightWithText(text) {
  const existing = document.querySelectorAll('.vault-highlight');
  for (const el of existing) {
    if (el.textContent === text) return true;
  }
  return false;
}

function highlightRangeAndScroll(range, text, id = null) {
  try {
    // extract contents and wrap them in a span
    const fragment = range.extractContents();
    const span = document.createElement('span');
    span.className = 'vault-highlight';
    if (id) span.setAttribute('data-vault-id', id);
    span.appendChild(fragment);
    range.insertNode(span);

    // scroll into view
    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  } catch (e) {
    // surroundContents can throw if the range partially selects non-text nodes.
    // fallback: attempt to collapse to start and highlight approximate area
    console.warn('highlightRangeAndScroll error', e);
    return false;
  }
}

function highlightAndScroll(text, attempt = 0, id = null) {
  const maxAttempts = 12;
  const retryDelay = 300;

  if (!text || typeof text !== 'string') return;

  // if we already added this exact text in the page, skip
  if (alreadyHasHighlightWithText(text)) return;

  // If page looks like a PDF URL (basic heuristics), skip to avoid errors
  const hrefNoQuery = window.location.href.split('#')[0].split('?')[0].toLowerCase();
  if (hrefNoQuery.endsWith('.pdf') || document.contentType === 'application/pdf' || hrefNoQuery.includes('/pdf')) {
    // Chrome's built-in PDF viewer renders PDF to canvas; annotating directly isn't supported here.
    // We avoid throwing errors — drawing on PDFs would require a different approach (PDF.js or overlay).
    console.info('Vault: PDF detected — in-document highlighting not supported for built-in PDF viewer.');
    return;
  }

  const range = findTextRangeAcrossNodes(text);

  if (range) {
    const ok = highlightRangeAndScroll(range, text, id);
    if (ok) return;
  }

  // fallback: try the older single-node approach (less robust)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeText = node.textContent;
    const index = nodeText.indexOf(text);
    if (index !== -1) {
      // check if already highlighted within parent
      if (!isAlreadyHighlighted(node, index, text.length)) {
        const r = document.createRange();
        r.setStart(node, index);
        r.setEnd(node, index + text.length);
        highlightRangeAndScroll(r, text, id);
        return;
      }
    }
  }

  // retry with delay (page might not have rendered text nodes yet)
  if (attempt < maxAttempts) {
    setTimeout(() => highlightAndScroll(text, attempt + 1, id), retryDelay);
  }
}

function isAlreadyHighlighted(node, index, length) {
  // simpler and more robust: check for any .vault-highlight in document matching the substring
  const substring = node.textContent.substring(index, index + length);
  const existing = document.querySelectorAll('.vault-highlight');
  for (const el of existing) {
    if (el.textContent === substring) return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "highlightText") {
    highlightAndScroll(message.text, 0, message.id || null);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // handle deep link hash (e.g., #highlight-...)
  try {
    const hash = decodeURIComponent(window.location.hash || "");
    if (hash.startsWith("#highlight-")) {
      const text = hash.replace("#highlight-", "");
      // attempt immediate highlight
      highlightAndScroll(text);
    }
  } catch (e) {
    console.warn('Error decoding hash highlight', e);
  }

  // Ask background for highlights for this page (exclude hash so storage keys match)
  chrome.runtime.sendMessage({
    type: "getHighlightsForPage",
    url: window.location.href.split("#")[0]
  });
});
