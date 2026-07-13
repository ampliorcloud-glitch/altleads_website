'use strict';
/* Render the leadership decks (HTML -> PDF) via Playwright/Chromium.
   Run with the career-ops Playwright on NODE_PATH:
     NODE_PATH="/e/New folder/Ankit/personal/career-ops-main/node_modules" node render-decks.cjs
   (Each .slide is 1280x720; one slide per PDF page.) */
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const dir = __dirname;
const decks = [
  { html: 'deck-product-launch.html', pdf: 'deck-product-launch.pdf' },
  { html: 'deck-product-guide.html',  pdf: 'deck-product-guide.pdf'  },
];

(async () => {
  const browser = await chromium.launch();
  for (const d of decks) {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(dir, d.html)).href, { waitUntil: 'networkidle' });
    await page.pdf({
      path: path.join(dir, d.pdf),
      width: '1280px', height: '720px',
      printBackground: true, pageRanges: '1-10',
    });
    await page.close();
    console.log('PDF written:', d.pdf);
  }
  await browser.close();
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
