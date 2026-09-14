import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

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

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 390, 430, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, acceptDownloads: true });
    const requests = [];
    page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

    await page.goto(origin, { waitUntil: 'load' });
    const exportButton = page.locator('#export-button');
    await expectEnabled(exportButton, `Export CTA must be enabled at ${width}px.`);

    await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
    await page.locator('#outer-screen img').waitFor({ state: 'attached' });
    await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
    await page.locator('#inner-screen img').waitFor({ state: 'attached' });

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'design-iphone-duo-both.png', `T039 filename must be deterministic at ${width}px.`);

    const stream = await download.createReadStream();
    assert.ok(stream, 'Download stream must be available.');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const png = Buffer.concat(chunks);
    assert.ok(png.length > 1000, `PNG Blob must contain rendered output at ${width}px.`);
    assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], 'Downloaded Blob must have the PNG signature.');

    await page.waitForFunction(() => document.getElementById('app-status')?.textContent?.includes('design-iphone-duo-both.png'));
    const status = await page.locator('#app-status').textContent();
    assert.match(status ?? '', /Screenshot content stayed in this browser\./, 'Status must explain local processing after download.');

    const imageSources = await page.evaluate(() => ({
      outer: document.querySelector('#outer-screen img')?.src,
      inner: document.querySelector('#inner-screen img')?.src
    }));
    assert.match(imageSources.outer ?? '', /^blob:/, 'Outer upload remains a local blob URL.');
    assert.match(imageSources.inner ?? '', /^blob:/, 'Inner upload remains a local blob URL.');

    const unexpectedRequests = requests.filter(({ url, method }) => method !== 'GET' || (!url.startsWith(origin) && !url.startsWith('blob:')));
    assert.deepEqual(unexpectedRequests, [], `Export must not create external/non-GET network requests at ${width}px.`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function expectEnabled(locator, message) {
  assert.equal(await locator.isDisabled(), false, message);
  assert.equal(await locator.getAttribute('aria-disabled'), null, `${message} aria-disabled must be absent while idle.`);
}

console.log('T039 Download PNG browser QA passed at 375/390/430/1024: deterministic filename, real PNG Blob, local uploads, and no external export network request.');
