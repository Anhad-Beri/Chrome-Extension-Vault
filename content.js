function highlightAndScroll(text, attempt = 0) {
  const maxAttempts = 10;
  const retryDelay = 300;

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const node = walk.currentNode;

    const nodeText = node.textContent;
    const index = nodeText.indexOf(text);
    
    if (index !== -1 && !isAlreadyHighlighted(node, index, text.length)) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);

      const span = document.createElement('span');
      span.textContent = text;
      span.style.backgroundColor = 'yellow';
      span.className = 'vault-highlight';

      range.deleteContents();
      range.insertNode(span);
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
  if (attempt < maxAttempts) {
    setTimeout(() => highlightAndScroll(text, attempt + 1), retryDelay);
  }
}
function isAlreadyHighlighted(node, index, length) {
  const parent = node.parentNode;
  if (!parent) return false;

  const existing = parent.querySelector('.vault-highlight');
  if (!existing) return false;
  return existing.textContent === node.textContent.substring(index, index + length);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "highlightText") {
    highlightAndScroll(message.text);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const hash = decodeURIComponent(window.location.hash);
  if (hash.startsWith("#highlight-")) {
    const text = hash.replace("#highlight-", "");
    highlightAndScroll(text);
  }

  chrome.runtime.sendMessage({
    type: "getHighlightsForPage",
    url: window.location.href.split("#")[0]
  });
});
