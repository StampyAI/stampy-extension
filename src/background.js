const isChrome = typeof browser === 'undefined';
const browserAPI = chrome;

// Helper for Chrome's different scripting API
async function injectScript(tabId, file) {
  if (isChrome) {
    return chrome.scripting.executeScript({
      target: { tabId },
      files: [file]
    });
  }
  return browserAPI.tabs.executeScript(tabId, { file });
}

async function injectCSS(tabId, file) {
  if (isChrome) {
    return chrome.scripting.insertCSS({
      target: { tabId },
      files: [file]
    });
  }
  return browserAPI.tabs.insertCSS(tabId, { file });
}

// Create context menu item
browserAPI.contextMenus.create({
  id: "analyze-selection",
  title: "Analyze with Stampy",
  contexts: ["selection"]
});

// Handle context menu clicks
browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("Context menu clicked", info.selectionText);
  if (info.menuItemId === "analyze-selection") {
    // Inject CSS and create popup in the current page
    await injectCSS(tab.id, "src/popup/popup.css");
    console.log("CSS injected");
    
    // Execute script - browser will handle duplicate injections
    await injectScript(tab.id, "src/popup/inject.js");
    console.log("Script injected");
    
    // Send the selected text to the injected script
    browserAPI.tabs.sendMessage(tab.id, {
      type: "ANALYZE_TEXT",
      text: info.selectionText
    });
    console.log("Message sent to content script");
  }
}); 