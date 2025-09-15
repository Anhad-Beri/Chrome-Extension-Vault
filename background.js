// background.js - MV3 service worker safe

function makeId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveHighlight",
    title: "Save Highlighted Text",
    contexts: ["selection"]
  });
});

// Send message safely
function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("Content script not ready, injecting...", chrome.runtime.lastError.message);
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      });
    }
  });
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveHighlight" && info.selectionText) {
    if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) return;

    const highlight = {
      id: makeId(),
      text: info.selectionText,
      url: tab.url.split("#")[0],
      title: tab.title
    };

    chrome.storage.sync.get({ highlights: [] }, (data) => {
      const highlights = data.highlights;
      highlights.push(highlight);
      chrome.storage.sync.set({ highlights }, () => {
        console.log("Highlight saved:", highlight);

        // Immediately highlight in the page
        sendMessageToTab(tab.id, { type: "highlightText", text: highlight.text, id: highlight.id });
      });
    });
  }
});

// Respond to content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "getHighlightsForPage") {
    const pageUrl = (message.url || "").split("#")[0];
    if (!pageUrl) return;

    chrome.storage.sync.get({ highlights: [] }, (data) => {
      const highlights = (data.highlights || []).filter(h => h.url === pageUrl);
      const tabId = sender && sender.tab && sender.tab.id;
      if (typeof tabId === "undefined") return;

      for (const h of highlights) {
        sendMessageToTab(tabId, { type: "highlightText", text: h.text, id: h.id });
      }
    });
    return;
  }

  if (message.type === "getAllHighlights") {
    chrome.storage.sync.get({ highlights: [] }, (data) => {
      sendResponse({ highlights: data.highlights || [] });
    });
    return true; // async
  }
});
