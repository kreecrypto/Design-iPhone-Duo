import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const outerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780"><rect width="360" height="780" fill="#222"/></svg>');
const innerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/></svg>');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
  await page.setContent(html, { waitUntil: 'load' });

  const toggle = page.locator('#app-icons-toggle');
  const overlay = page.locator('#inner-app-icons-overlay');
  assert.equal(await toggle.isEnabled(), true, 'App icons switch must be enabled.');
  assert.equal(await toggle.getAttribute('role'), 'switch');
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  assert.equal(await overlay.isHidden(), true, 'App icons overlay starts hidden.');

  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#outer-screen img').waitFor({ state: 'attached' });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.locator('#inner-screen img').waitFor({ state: 'attached' });

  const before = await page.evaluate(() => ({
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    outerHtml: document.querySelector('#outer-panel')?.innerHTML,
    innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode
  }));

  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true', 'App icons switch exposes on state.');
  assert.equal(await overlay.isVisible(), true, 'App icons overlay becomes visible.');

  const onState = await page.evaluate(() => ({
    workspaceIcons: document.querySelector('#preview-workspace')?.dataset.appIcons,
    innerIcons: document.querySelector('.inner-device-frame')?.dataset.appIcons,
    pointerEvents: getComputedStyle(document.querySelector('#inner-app-icons-overlay')).pointerEvents,
    iconCount: document.querySelectorAll('#inner-app-icons-overlay .app-icon').length,
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    outerHtml: document.querySelector('#outer-panel')?.innerHTML,
    status: document.querySelector('#app-status')?.textContent
  }));

  assert.equal(onState.workspaceIcons, 'on', 'Shared presentation state must expose appIcons=on for the export compositor.');
  assert.equal(onState.innerIcons, 'on', 'Inner device frame must expose appIcons=on.');
  assert.equal(onState.pointerEvents, 'none', 'App icons overlay must never intercept pointer input.');
  assert.equal(onState.iconCount, 5, 'Synthetic app icon overlay must have stable original icon geometry.');
  assert.equal(onState.outerSrc, before.outerSrc, 'Outer image state must not change when App icons toggles.');
  assert.equal(onState.innerSrc, before.innerSrc, 'Inner image object URL must be preserved.');
  assert.equal(onState.outerHtml, before.outerHtml, 'Outer preview DOM must be unchanged by the Inner-only App icons control.');
  assert.match(onState.status ?? '', /Inner app icons shown/i, 'Toggle must announce preview feedback.');

  await page.locator('#fit-mode').click();
  await page.locator('#view-both').click();
  assert.equal(await overlay.isVisible(), true, 'App icons state must survive Fit and Both interactions.');
  assert.equal(await page.locator('#inner-screen img').getAttribute('data-fit-mode'), 'fit', 'Fit behavior remains functional while App icons are on.');

  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  assert.equal(await overlay.isHidden(), true, 'App icons overlay hides when switched off.');
  assert.equal(await page.locator('#preview-workspace').getAttribute('data-app-icons'), 'off');

  await page.close();
} finally {
  await browser.close();
}

console.log('T025 app icons browser QA passed: Inner-only toggle, state preservation, pointer safety, and compositor-ready state contract verified.');
