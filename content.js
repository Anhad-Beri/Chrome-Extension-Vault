
function getTextNodes(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      
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
        offset: endIndex - info.start + 1
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

function highlightRangeAndScroll(range, text, id = null, shouldScroll = true) {
  try {
    const fragment = range.extractContents();
    const span = document.createElement('span');
    span.className = 'vault-highlight';
    if (id) span.setAttribute('data-vault-id', id);
    span.appendChild(fragment);
    range.insertNode(span);

    if (shouldScroll) {
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      span.style.outline = "2px solid orange";
      setTimeout(() => (span.style.outline = ""), 2000);
    }

    return true;
  } catch (e) {
    console.warn('highlightRangeAndScroll error', e);
    return false;
  }
}

function highlightAndScroll(text, attempt = 0, id = null, shouldScroll = true) {
  const maxAttempts = 12;
  const retryDelay = 300;

  if (!text || typeof text !== 'string') return;

  if (alreadyHasHighlightWithText(text)) return;

  const hrefNoQuery = window.location.href.split('#')[0].split('?')[0].toLowerCase();
  if (hrefNoQuery.endsWith('.pdf') || document.contentType === 'application/pdf' || hrefNoQuery.includes('/pdf')) {
    console.info('Vault: PDF detected — highlighting not supported in built-in PDF viewer.');
    return;
  }

  const range = findTextRangeAcrossNodes(text);

  if (range) {
    const ok = highlightRangeAndScroll(range, text, id, shouldScroll);
    if (ok) return;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeText = node.textContent;
    const index = nodeText.indexOf(text);
    if (index !== -1) {
      if (!isAlreadyHighlighted(node, index, text.length)) {
        const r = document.createRange();
        r.setStart(node, index);
        r.setEnd(node, index + text.length);
        highlightRangeAndScroll(r, text, id, shouldScroll);
        return;
      }
    }
  }

  if (attempt < maxAttempts) {
    setTimeout(() => highlightAndScroll(text, attempt + 1, id, shouldScroll), retryDelay);
  }
}

function isAlreadyHighlighted(node, index, length) {
  const substring = node.textContent.substring(index, index + length);
  const existing = document.querySelectorAll('.vault-highlight');
  for (const el of existing) {
    if (el.textContent === substring) return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "highlightText") {
    highlightAndScroll(message.text, 0, message.id || null, true);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  try {
    const hash = decodeURIComponent(window.location.hash || "");
    if (hash.startsWith("#highlight-")) {
      const text = hash.replace("#highlight-", "");
      highlightAndScroll(text, 0, null, true);
    }
  } catch (e) {
    console.warn('Error decoding hash highlight', e);
  }

  chrome.runtime.sendMessage({
    type: "getHighlightsForPage",
    url: window.location.href.split("#")[0]
  });
});


function reapplyHighlightsForPage() {
  chrome.storage.sync.get(["highlights"], (data) => {
    if (!data.highlights) return;
    const currentUrl = window.location.href.split("#")[0];
    const highlights = data.highlights.filter((h) => h.url === currentUrl);
    highlights.forEach((h) => highlightAndScroll(h.text, 0, h.id || null, false));
  });
}

document.addEventListener("DOMContentLoaded", reapplyHighlightsForPage);
setTimeout(reapplyHighlightsForPage, 1500);
