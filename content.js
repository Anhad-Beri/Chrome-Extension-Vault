chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "highlightText") {
      const textToHighlight = request.text;
  
      const regex = new RegExp(textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentNode;
        if (!parent) continue;
  
        const match = node.nodeValue.match(regex);
        if (match) {
          const span = document.createElement("span");
          span.textContent = node.nodeValue;
          span.innerHTML = node.nodeValue.replace(regex, (match) => `<mark style="background-color: yellow;">${match}</mark>`);
          parent.replaceChild(span, node);
        }
      }
    }
  });
  
  // Request saved highlights from background when page loads
  chrome.runtime.sendMessage({ type: "getHighlightsForPage", url: window.location.href });
  