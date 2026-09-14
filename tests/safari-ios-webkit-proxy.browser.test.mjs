import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { devices, webkit } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url));
const compositor = await readFile(new URL('../src/export-compositor.js', import.meta.url));
const outerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780"><rect width="360" height="780" fill="#c33"/></svg>');
const innerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#36c"/></svg>');

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

const browser = await webkit.launch({ headless: true });
try {
  const iphone = devices['iPhone 13'];
  assert.ok(iphone, 'Playwright iPhone 13 device profile must be available.');

  // WebKit/iPhone-profile proxy: verify the local upload + real PNG export path.
  const context = await browser.newContext({ ...iphone, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto(origin, { waitUntil: 'load' });

  assert.equal(await page.locator('#export-button').isDisabled(), false, 'Export must be available under the iPhone WebKit profile.');
  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#outer-screen img').waitFor({ state: 'attached' });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.locator('#inner-screen img').waitFor({ state: 'attached' });

  const sources = await page.evaluate(() => ({
    outer: document.querySelector('#outer-screen img')?.src,
    inner: document.querySelector('#inner-screen img')?.src,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  assert.match(sources.outer ?? '', /^blob:/, 'Outer upload must remain browser-local.');
  assert.match(sources.inner ?? '', /^blob:/, 'Inner upload must remain browser-local.');
  assert.ok(sources.bodyWidth <= sources.viewportWidth, 'iPhone WebKit profile must not horizontally overflow.');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'design-iphone-duo-both.png', 'WebKit proxy export filename must be deterministic.');
  const stream = await download.createReadStream();
  assert.ok(stream, 'WebKit proxy download stream must be readable.');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.ok(png.length > 1000, 'WebKit proxy export must contain rendered PNG bytes.');
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], 'WebKit proxy export must have a PNG signature.');

  const unexpectedRequests = requests.filter(({ url, method }) => method !== 'GET' || (!url.startsWith(origin) && !url.startsWith('blob:')));
  assert.deepEqual(unexpectedRequests, [], 'WebKit proxy upload/export must not send screenshot content externally.');
  await context.close();

  // Explicit blocked-save path: verify the in-app browser fallback remains visible and usable.
  const fallbackContext = await browser.newContext({ ...iphone });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.addInitScript(() => {
    HTMLAnchorElement.prototype.click = function blockedDownload() {
      throw new Error('Simulated iOS in-app browser save block');
    };
  });
  await fallbackPage.goto(origin, { waitUntil: 'load' });
  await fallbackPage.locator('#export-button').click();
  const guidance = fallbackPage.locator('#save-fallback-guidance');
  await guidance.waitFor({ state: 'visible' });
  assert.match((await guidance.textContent()) ?? '', /open this page in Safari or Chrome/i, 'Blocked-save fallback must provide open-in-browser guidance.');
  assert.equal(await guidance.getAttribute('role'), 'note', 'Blocked-save guidance must retain accessible note semantics.');
  const fallbackLayout = await fallbackPage.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  assert.ok(fallbackLayout.body <= fallbackLayout.viewport, 'Fallback must not horizontally overflow the iPhone WebKit profile.');
  await fallbackContext.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T056 WebKit/iPhone-profile proxy QA passed: local uploads, PNG export, privacy, mobile layout, and blocked-save fallback. Real Safari on iOS hardware/simulator is still required to close T056.');
