// Content script for Phone Number Decoder
// Scans phpBB post content and annotates obfuscated phone numbers with tooltips.

(() => {
  'use strict';

  let decodedCount = 0;
  let enabled = true;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toggle') {
      enabled = message.enabled;
      if (enabled) {
        scanPage();
      } else {
        removeAnnotations();
      }
    } else if (message.type === 'get-count') {
      sendResponse({ count: decodedCount });
    }
    return false;
  });

  /**
   * Remove all annotations we've added.
   */
  function removeAnnotations() {
    document.querySelectorAll('.mvpd-decoded').forEach(span => {
      const text = document.createTextNode(span.dataset.original);
      span.parentNode.replaceChild(text, span);
    });
    decodedCount = 0;
    notifyCount();
  }

  /**
   * Notify the background script of the current decode count.
   */
  function notifyCount() {
    try {
      chrome.runtime.sendMessage({ type: 'decoded-count', count: decodedCount });
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  /**
   * Scan the page for post content and decode phone numbers.
   */
  function scanPage() {
    if (!enabled) return;

    // phpBB post content lives in div.content inside post wrappers
    const contentDivs = document.querySelectorAll('div.content');
    if (contentDivs.length === 0) {
      // Fallback: scan the whole body if no phpBB content divs found
      // (handles non-standard page layouts)
      processNode(document.body);
    } else {
      contentDivs.forEach(div => processNode(div));
    }

    notifyCount();
  }

  /**
   * Walk all text nodes under `root` and apply decoding.
   */
  function processNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Skip nodes we've already processed
        if (node.parentNode.classList && node.parentNode.classList.contains('mvpd-decoded')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip script/style nodes
        const tag = node.parentNode.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    // Process in reverse to avoid offset issues when modifying DOM
    for (let i = textNodes.length - 1; i >= 0; i--) {
      decodeTextNode(textNodes[i]);
    }
  }

  /**
   * Find phone numbers in a text node and wrap them in annotated spans.
   */
  function decodeTextNode(textNode) {
    const text = textNode.textContent;
    if (!text || text.trim().length < 7) return;

    const matches = PhoneDecoder.findPhoneNumbers(text);
    if (matches.length === 0) return;

    const parent = textNode.parentNode;
    const frag = document.createDocumentFragment();
    let lastEnd = 0;

    for (const match of matches) {
      // Add text before this match
      if (match.start > lastEnd) {
        frag.appendChild(document.createTextNode(text.substring(lastEnd, match.start)));
      }

      // Create annotated span
      const span = document.createElement('span');
      span.className = 'mvpd-decoded';
      span.title = match.decoded;
      span.dataset.original = match.original;
      span.dataset.decoded = match.decoded;
      span.textContent = match.original;
      frag.appendChild(span);

      decodedCount++;
      lastEnd = match.end;
    }

    // Add remaining text after last match
    if (lastEnd < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    parent.replaceChild(frag, textNode);
  }

  // Initial scan
  async function init() {
    const { enabled: storedEnabled = true } = await chrome.storage.local.get('enabled');
    enabled = storedEnabled;
    if (enabled) {
      scanPage();
    }
  }

  // Observe for dynamically loaded content (phpBB pagination via AJAX, etc.)
  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processNode(node);
          notifyCount();
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  init();
})();
