// Popup logic for Phone Number Decoder

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('enabled');
  const countEl = document.getElementById('count');

  // Load saved state
  const { enabled = true } = await chrome.storage.local.get('enabled');
  toggle.checked = enabled;

  // Toggle handler
  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ enabled: toggle.checked });
    // Notify content scripts
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'toggle', enabled: toggle.checked });
    }
  });

  // Get decode count from active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'get-count' }, (response) => {
        if (response && typeof response.count === 'number') {
          countEl.textContent = response.count;
        }
      });
    }
  } catch (e) {
    // Tab may not have content script
  }
});
