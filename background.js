// Background service worker for Phone Number Decoder
// Manages extension state and badge updates

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'decoded-count') {
    // Update badge with count of decoded numbers
    const text = message.count > 0 ? String(message.count) : '';
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4a90d9', tabId: sender.tab.id });
  }
  return false;
});
