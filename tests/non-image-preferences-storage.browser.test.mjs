import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url));
const compositor = await readFile(new URL('../src/export-compositor.js', import.meta.url));
const preferenceKey = 'design-iphone-duo.preferences.v1';

const server = createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
    return;
  }
  if (request.url === '/src/export-compositor.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    response.end(compositor);
    return;
  }
  response.writeHead(404);
  response.end('Not found');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;

const outerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="108" height="234"><rect width="108" height="234" fill="#123456"/></svg>');
const innerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#654321"/></svg>');

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 1000 } });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'load' });

  await page.locator('#outer-upload').setInputFiles({ name: 'private-outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#inner-upload').setInputFiles({ name: 'private-inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.waitForFunction(() => document.querySelector('#outer-screen img')?.complete && document.querySelector('#inner-screen img')?.complete);

  await page.locator('#view-inner').click();
  await page.locator('#fit-mode').click();
  await page.locator('#crease-toggle').click();
  await page.locator('#app-icons-toggle').click();
  await page.waitForFunction((key) => localStorage.getItem(key)?.includes('"viewMode":"inner"'), preferenceKey);

  const beforeReload = await page.evaluate(async (key) => ({
    localEntries: Object.entries(localStorage),
    sessionEntries: Object.entries(sessionStorage),
    idbNames: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((db) => db.name) : [],
    cacheNames: 'caches' in window ? await caches.keys() : [],
    outerSrc: document.querySelector('#outer-screen img')?.src || '',
    innerSrc: document.querySelector('#inner-screen img')?.src || '',
    preference: JSON.parse(localStorage.getItem(key))
  }), preferenceKey);

  assert.ok(beforeReload.outerSrc.startsWith('blob:'), 'Outer upload must stay on a local blob URL.');
  assert.ok(beforeReload.innerSrc.startsWith('blob:'), 'Inner upload must stay on a local blob URL.');
  assert.deepEqual(beforeReload.sessionEntries, [], 'No screenshot or preference data may be written to sessionStorage.');
  assert.deepEqual(beforeReload.idbNames.filter(Boolean), [], 'No IndexedDB database may persist screenshot content.');
  assert.deepEqual(beforeReload.cacheNames, [], 'No Cache Storage entry may persist screenshot content.');
  assert.equal(beforeReload.localEntries.length, 1, 'Only the preference record may be written to localStorage.');
  assert.equal(beforeReload.localEntries[0][0], preferenceKey);
  assert.deepEqual(beforeReload.preference, {
    version: 1,
    viewMode: 'inner',
    fitMode: 'fit',
    crease: true,
    appIcons: true
  });

  const serializedStorage = JSON.stringify(beforeReload.localEntries);
  for (const forbidden of ['private-outer.svg', 'private-inner.svg', 'blob:', 'data:image', '<svg', '#123456', '#654321']) {
    assert.equal(serializedStorage.includes(forbidden), false, `Persistent storage must not contain screenshot material: ${forbidden}`);
  }

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#preview-workspace')?.dataset.viewMode === 'inner');

  const restored = await page.evaluate((key) => ({
    viewMode: document.querySelector('#preview-workspace')?.dataset.viewMode,
    fitPressed: document.querySelector('#fit-mode')?.getAttribute('aria-pressed'),
    crease: document.querySelector('#crease-toggle')?.getAttribute('aria-checked'),
    appIcons: document.querySelector('#app-icons-toggle')?.getAttribute('aria-checked'),
    outerImageCount: document.querySelectorAll('#outer-screen img').length,
    innerImageCount: document.querySelectorAll('#inner-screen img').length,
    outerInputValue: document.querySelector('#outer-upload')?.value,
    innerInputValue: document.querySelector('#inner-upload')?.value,
    preference: JSON.parse(localStorage.getItem(key)),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth
  }), preferenceKey);

  assert.equal(restored.viewMode, 'inner');
  assert.equal(restored.fitPressed, 'true');
  assert.equal(restored.crease, 'true');
  assert.equal(restored.appIcons, 'true');
  assert.deepEqual(restored.preference, beforeReload.preference, 'Only non-image preferences should survive reload.');
  assert.equal(restored.outerImageCount, 0, 'Outer screenshot bytes/state must not survive reload.');
  assert.equal(restored.innerImageCount, 0, 'Inner screenshot bytes/state must not survive reload.');
  assert.equal(restored.outerInputValue, '');
  assert.equal(restored.innerInputValue, '');
  assert.ok(restored.bodyWidth <= restored.viewportWidth, 'Preference restoration must not introduce 320px horizontal overflow.');

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T028/T045 storage QA passed: non-image preferences persist; screenshots, filenames, blob URLs, and image bytes do not.');
