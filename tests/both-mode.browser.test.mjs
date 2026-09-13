import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const outerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780"><rect width="360" height="780" fill="#222"/><text x="24" y="64" fill="white">Outer fixture</text></svg>');
const innerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/><text x="24" y="64" fill="#111">Inner fixture</text></svg>');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
  await page.setContent(html, { waitUntil: 'load' });

  assert.equal(await page.locator('#view-both').isEnabled(), true, 'Both mode must be an enabled control.');
  assert.equal(await page.locator('#view-outer').isDisabled(), true, 'Outer-only remains disabled until T022.');
  assert.equal(await page.locator('#view-inner').isDisabled(), true, 'Inner-only remains disabled until T023.');

  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#outer-screen img').waitFor({ state: 'attached' });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.locator('#inner-screen img').waitFor({ state: 'attached' });

  const before = await page.evaluate(() => ({
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    outerFit: document.querySelector('#outer-screen img')?.dataset.fitMode,
    innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode
  }));

  await page.locator('#view-both').click();

  const after = await page.evaluate(() => ({
    mode: document.querySelector('#preview-workspace')?.dataset.viewMode,
    outerHidden: document.querySelector('#outer-panel')?.hidden,
    innerHidden: document.querySelector('#inner-panel')?.hidden,
    bothPressed: document.querySelector('#view-both')?.getAttribute('aria-pressed'),
    outerPressed: document.querySelector('#view-outer')?.getAttribute('aria-pressed'),
    innerPressed: document.querySelector('#view-inner')?.getAttribute('aria-pressed'),
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    outerFit: document.querySelector('#outer-screen img')?.dataset.fitMode,
    innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode,
    status: document.querySelector('#app-status')?.textContent
  }));

  assert.equal(after.mode, 'both', 'Workspace must expose mode=both.');
  assert.equal(after.outerHidden, false, 'Outer preview must be visible in Both mode.');
  assert.equal(after.innerHidden, false, 'Inner preview must be visible in Both mode.');
  assert.equal(after.bothPressed, 'true', 'Both control must expose selected state.');
  assert.equal(after.outerPressed, 'false');
  assert.equal(after.innerPressed, 'false');
  assert.equal(after.outerSrc, before.outerSrc, 'Outer image object URL must be retained when Both is selected.');
  assert.equal(after.innerSrc, before.innerSrc, 'Inner image object URL must be retained when Both is selected.');
  assert.equal(after.outerFit, before.outerFit, 'Outer fit state must be retained.');
  assert.equal(after.innerFit, before.innerFit, 'Inner fit state must be retained.');
  assert.match(after.status ?? '', /Both view active/i, 'Mode change must provide polite status feedback.');

  await page.close();
} finally {
  await browser.close();
}

console.log('Both mode browser QA passed: both previews remain visible and loaded image state is preserved.');
