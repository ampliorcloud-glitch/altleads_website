/**
 * data-research/src/background.ts  —  MV3 service worker
 *
 * Same URL-only detection pattern as contact-viewer.
 * Reads tab.url to detect LinkedIn /in/ profiles and posts the slug
 * to the side panel for research context.
 *
 * NO content scripts. NO page DOM reading. NO injection.
 */

import { normalizeLinkedinSlug } from '@shared/normalizeLinkedin';
import type { BgMessage } from '@shared/types';

// Open side panel on toolbar icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e: unknown) => console.error('[AltLeads Research BG] setPanelBehavior error', e));

function processTabUrl(url: string | undefined): void {
  if (!url) {
    postToPanel({ type: 'TAB_IDLE' });
    return;
  }
  const slug = normalizeLinkedinSlug(url);
  if (slug) {
    postToPanel({ type: 'TAB_URL', url, slug });
  } else {
    postToPanel({ type: 'TAB_IDLE' });
  }
}

function postToPanel(msg: BgMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Panel not open — normal
  });
}

// Debounce 300ms so rapid LinkedIn SPA navigations don't thrash/flicker
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === tabId) processTabUrl(changeInfo.url);
    });
  }, 300);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    processTabUrl(tab.url);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'QUERY_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      const slug = normalizeLinkedinSlug(url);
      sendResponse(
        slug
          ? ({ type: 'TAB_URL', url, slug } satisfies BgMessage)
          : ({ type: 'TAB_IDLE' } satisfies BgMessage)
      );
    });
    return true;
  }
});

console.log('[AltLeads Research BG] service worker started');
