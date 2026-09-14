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

  const crease = page.locator('#crease-toggle');
  const overlay = page.locator('#inner-crease-overlay');
  assert.equal(await crease.isEnabled(), true, 'Crease switch must be enabled.');
  assert.equal(await crease.getAttribute('role'), 'switch');
  assert.equal(await crease.getAttribute('aria-checked'), 'false');
  assert.equal(await overlay.isHidden(), true, 'Crease overlay starts hidden.');

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

  await crease.click();
  assert.equal(await crease.getAttribute('aria-checked'), 'true', 'Crease switch exposes on state.');
  assert.equal(await overlay.isVisible(), true, 'Crease overlay becomes visible.');

  const onState = await page.evaluate(() => ({
    workspaceCrease: document.querySelector('#preview-workspace')?.dataset.crease,
    innerCrease: document.querySelector('.inner-device-frame')?.dataset.crease,
    pointerEvents: getComputedStyle(document.querySelector('#inner-crease-overlay')).pointerEvents,
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    outerHtml: document.querySelector('#outer-panel')?.innerHTML,
    status: document.querySelector('#app-status')?.textContent
  }));

  assert.equal(onState.workspaceCrease, 'on', 'Shared presentation state must expose crease=on for the future export compositor.');
  assert.equal(onState.innerCrease, 'on', 'Inner device frame must expose crease=on.');
  assert.equal(onState.pointerEvents, 'none', 'Crease overlay must never intercept pointer input.');
  assert.equal(onState.outerSrc, before.outerSrc, 'Outer image state must not change when crease toggles.');
  assert.equal(onState.innerSrc, before.innerSrc, 'Inner image object URL must be preserved.');
  assert.equal(onState.outerHtml, before.outerHtml, 'Outer preview DOM must be unchanged by the Inner-only crease control.');
  assert.match(onState.status ?? '', /Inner crease shown/i, 'Toggle must announce preview feedback.');

  await page.locator('#fit-mode').click();
  await page.locator('#view-both').click();
  assert.equal(await overlay.isVisible(), true, 'Crease state must survive Fit and Both interactions.');
  assert.equal(await page.locator('#inner-screen img').getAttribute('data-fit-mode'), 'fit', 'Fit behavior remains functional while crease is on.');

  await crease.click();
  assert.equal(await crease.getAttribute('aria-checked'), 'false');
  assert.equal(await overlay.isHidden(), true, 'Crease overlay hides when switched off.');
  assert.equal(await page.locator('#preview-workspace').getAttribute('data-crease'), 'off');

  await page.close();
} finally {
  await browser.close();
}

console.log('T024 crease browser QA passed: Inner-only toggle, state preservation, pointer safety, and compositor-ready state contract verified.');
