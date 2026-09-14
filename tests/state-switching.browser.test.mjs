import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url));
const compositor = await readFile(new URL('../src/export-compositor.js', import.meta.url));

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
  for (const width of [320, 390, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(origin, { waitUntil: 'load' });

    await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
    await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
    await page.waitForFunction(() => document.querySelector('#outer-screen img')?.complete && document.querySelector('#inner-screen img')?.complete);
    await page.locator('#fit-mode').click();
    await page.locator('#crease-toggle').click();
    await page.locator('#app-icons-toggle').click();

    const baseline = await page.evaluate(() => ({
      outerSrc: document.querySelector('#outer-screen img')?.src,
      innerSrc: document.querySelector('#inner-screen img')?.src,
      outerFit: document.querySelector('#outer-screen img')?.dataset.fitMode,
      innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode,
      fitPressed: document.querySelector('#fit-mode')?.getAttribute('aria-pressed'),
      crease: document.querySelector('#crease-toggle')?.getAttribute('aria-checked'),
      appIcons: document.querySelector('#app-icons-toggle')?.getAttribute('aria-checked')
    }));

    assert.ok(baseline.outerSrc?.startsWith('blob:'), 'Outer screenshot must stay browser-local.');
    assert.ok(baseline.innerSrc?.startsWith('blob:'), 'Inner screenshot must stay browser-local.');
    assert.equal(baseline.fitPressed, 'true');
    assert.equal(baseline.outerFit, 'fit');
    assert.equal(baseline.innerFit, 'fit');

    for (const mode of ['outer', 'inner', 'both', 'inner', 'outer', 'both']) {
      await page.locator(`#view-${mode}`).click();
      assert.equal(await page.locator('#preview-workspace').getAttribute('data-view-mode'), mode);

      const retained = await page.evaluate(() => ({
        outerSrc: document.querySelector('#outer-screen img')?.src,
        innerSrc: document.querySelector('#inner-screen img')?.src,
        outerFit: document.querySelector('#outer-screen img')?.dataset.fitMode,
        innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode,
        fitPressed: document.querySelector('#fit-mode')?.getAttribute('aria-pressed'),
        crease: document.querySelector('#crease-toggle')?.getAttribute('aria-checked'),
        appIcons: document.querySelector('#app-icons-toggle')?.getAttribute('aria-checked')
      }));
      assert.deepEqual(retained, baseline, `State must survive switch to ${mode} at ${width}px.`);

      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
      assert.ok(geometry.body <= geometry.viewport, `State switching must not introduce horizontal overflow at ${width}px.`);
    }

    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T048 state-switching QA passed at 320/390/1024 with both local images and preview state retained.');
