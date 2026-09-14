import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url));
const compositor = await readFile(new URL('../src/export-compositor.js', import.meta.url));
const preferenceKey = 'design-iphone-duo.preferences.v1';

const outerMarker = 'T062_PRIVATE_OUTER_9F2C';
const innerMarker = 'T062_PRIVATE_INNER_6A71';
const outerName = 't062-private-outer.svg';
const innerName = 't062-private-inner.svg';
const outerSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780"><title>${outerMarker}</title><rect width="360" height="780" fill="#123456"/></svg>`);
const innerSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><title>${innerMarker}</title><rect width="800" height="600" fill="#654321"/></svg>`);

const serverRequests = [];
const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    serverRequests.push({ method: request.method, url: request.url, body: Buffer.concat(chunks).toString('utf8') });
  });

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

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const browserRequests = [];
  page.on('request', (request) => browserRequests.push({
    method: request.method(),
    url: request.url(),
    postData: request.postData() || ''
  }));

  await page.goto(origin, { waitUntil: 'load' });
  await page.locator('#outer-upload').setInputFiles({ name: outerName, mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#inner-upload').setInputFiles({ name: innerName, mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.waitForFunction(() => document.querySelector('#outer-screen img')?.complete && document.querySelector('#inner-screen img')?.complete);

  await page.locator('#fit-mode').click();
  await page.locator('#crease-toggle').click();
  await page.locator('#app-icons-toggle').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'design-iphone-duo-both.png');
  const stream = await download.createReadStream();
  assert.ok(stream, 'Export download stream must be available.');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.ok(png.length > 1000, 'Export must produce a non-empty PNG.');
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], 'Export must be a PNG.');

  const storage = await page.evaluate(async (key) => ({
    localEntries: Object.entries(localStorage),
    sessionEntries: Object.entries(sessionStorage),
    idbNames: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((db) => db.name).filter(Boolean) : [],
    cacheNames: 'caches' in window ? await caches.keys() : [],
    outerSrc: document.querySelector('#outer-screen img')?.src || '',
    innerSrc: document.querySelector('#inner-screen img')?.src || '',
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    preference: JSON.parse(localStorage.getItem(key))
  }), preferenceKey);

  assert.match(storage.outerSrc, /^blob:/, 'Outer screenshot must remain a browser-local blob URL.');
  assert.match(storage.innerSrc, /^blob:/, 'Inner screenshot must remain a browser-local blob URL.');
  assert.deepEqual(storage.sessionEntries, [], 'sessionStorage must contain no screenshot material.');
  assert.deepEqual(storage.idbNames, [], 'IndexedDB must contain no screenshot material.');
  assert.deepEqual(storage.cacheNames, [], 'Cache Storage must contain no screenshot material.');
  assert.equal(storage.localEntries.length, 1, 'Only the allowlisted preference record may be stored.');
  assert.equal(storage.localEntries[0][0], preferenceKey);
  assert.deepEqual(storage.preference, { version: 1, viewMode: 'both', fitMode: 'fit', crease: true, appIcons: true });
  assert.ok(storage.bodyWidth <= storage.viewportWidth, 'Privacy audit flow must preserve 320px no-overflow behavior.');

  const forbiddenTokens = [outerMarker, innerMarker, outerName, innerName, '<svg', 'data:image'];
  const serializedStorage = JSON.stringify({ local: storage.localEntries, session: storage.sessionEntries, idb: storage.idbNames, caches: storage.cacheNames });
  const serializedBrowserRequests = JSON.stringify(browserRequests);
  const serializedServerRequests = JSON.stringify(serverRequests);

  for (const token of forbiddenTokens) {
    assert.equal(serializedStorage.includes(token), false, `Persistent/browser storage must not contain screenshot token: ${token}`);
    assert.equal(serializedBrowserRequests.includes(token), false, `Browser network requests must not contain screenshot token: ${token}`);
    assert.equal(serializedServerRequests.includes(token), false, `HTTP server must not receive screenshot token: ${token}`);
  }

  const unexpectedNetwork = browserRequests.filter(({ method, url }) => method !== 'GET' || (!url.startsWith(origin) && !url.startsWith('blob:')));
  assert.deepEqual(unexpectedNetwork, [], 'Upload/preview/export must not create external or non-GET network requests.');
  assert.deepEqual(serverRequests.filter(({ method }) => method !== 'GET'), [], 'Local HTTP server must receive GET requests only.');

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T062 privacy audit passed: private screenshot content stayed in browser across upload, preview, preference changes, PNG export, network capture, and storage audit at 320px.');
