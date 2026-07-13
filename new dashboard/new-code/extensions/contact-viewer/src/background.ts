/**
 * contact-viewer/src/background.ts  —  MV3 service worker
 *
 * The ONLY LinkedIn-facing code in the extension.
 * Reads the active tab's URL (tab.url via the "tabs" permission).
 * NEVER reads the LinkedIn page DOM, injects scripts, or requests
 * a linkedin.com host permission.
 *
 * Responsibilities:
 *  1. Open the side panel on toolbar icon click.
 *  2. Watch for tab URL changes (catches LinkedIn SPA navigation via
 *     chrome.tabs.onUpdated — no page MutationObserver needed).
 *  3. Watch for tab switches (chrome.tabs.onActivated).
 *  4. Normalize the slug and post a TAB_URL or TAB_IDLE message to the panel.
 */

import { normalizeLinkedinSlug } from '@shared/normalizeLinkedin';
import type { BgMessage } from '@shared/types';

// ---------------------------------------------------------------------------
// 1. Open the side panel when the toolbar icon is clicked
// ---------------------------------------------------------------------------

// This allows the side panel to open/close on action icon click (MV3 API).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e: unknown) => console.error('[AltLeads BG] setPanelBehavior error', e));

// ---------------------------------------------------------------------------
// 2. Process a tab's URL and post the result to the side panel
// ---------------------------------------------------------------------------

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
  // chrome.runtime.sendMessage sends to all extension pages (incl. the side panel).
  // We ignore errors — the panel may not be open yet; it will query the
  // current state on mount.
  chrome.runtime.sendMessage(msg).catch(() => {
    // Side panel not open — this is normal; ignore.
  });
}

// ---------------------------------------------------------------------------
// 3. Listen for SPA navigation on the active tab (URL change without reload)
//    Debounced 300ms so rapid LinkedIn SPA navigations don't thrash.
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only act when the URL changes on the active tab.
  // changeInfo.url fires on SPA pushState — exactly what we need for LinkedIn.
  if (!changeInfo.url) return;

  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === tabId) {
        processTabUrl(changeInfo.url);
      }
    });
  }, 300);
});

// ---------------------------------------------------------------------------
// 4. Listen for tab switches
// ---------------------------------------------------------------------------

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return; // tab may have closed
    processTabUrl(tab.url);
  });
});

// ---------------------------------------------------------------------------
// 5. Respond to "what is the current tab?" queries from the side panel
//    (the panel asks this on mount so it can display the right state
//    even if the background worker was freshly started)
// ---------------------------------------------------------------------------

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
    return true; // keep message channel open for async sendResponse
  }
});

console.log('[AltLeads BG] service worker started');
