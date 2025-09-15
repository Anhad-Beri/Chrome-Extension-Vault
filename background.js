chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveHighlight",
    title: "Save Highlighted Text",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveHighlight" && info.selectionText) {
    const highlight = {
      text: info.selectionText,
      url: tab.url,
      title: tab.title
    };

    chrome.storage.sync.get({ highlights: [] }, (data) => {
      const highlights = data.highlights;
      highlights.push(highlight);
      chrome.storage.sync.set({ highlights });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getHighlightsForPage") {
    const pageUrl = message.url;
    chrome.storage.sync.get({ highlights: [] }, (data) => {
      const highlights = data.highlights.filter(h => h.url === pageUrl);
      for (const h of highlights) {
        chrome.tabs.sendMessage(sender.tab.id, { type: "highlightText", text: h.text });
      }
    });
  }
});
