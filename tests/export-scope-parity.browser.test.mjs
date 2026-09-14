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

const outerColor = '#25a65a';
const innerColor = '#356bd8';
const outerSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="234"><rect width="108" height="234" fill="${outerColor}"/></svg>`);
const innerSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="${innerColor}"/></svg>`);

function closeRgb(actual, expected, tolerance = 10) {
  assert.equal(actual.length, 3);
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs(actual[i] - expected[i]) <= tolerance, `RGB channel ${i} expected ${expected[i]}±${tolerance}, got ${actual[i]}`);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1100 }, deviceScaleFactor: 1 });
  await page.goto(origin, { waitUntil: 'load' });
  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.waitForFunction(() => document.querySelector('#outer-screen img')?.complete && document.querySelector('#inner-screen img')?.complete);
  await page.locator('#fit-mode').click();
  await page.locator('#crease-toggle').click();
  await page.locator('#app-icons-toggle').click();

  const outerShot = await page.locator('.outer-device-frame').screenshot();
  const innerShot = await page.locator('.inner-device-frame').screenshot();

  const result = await page.evaluate(async ({ outerPng, innerPng }) => {
    const samplePng = async (base64, xFraction, yFraction) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * xFraction)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * yFraction)));
      return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
    };

    const sampleCanvas = (canvas, placement, xFraction, yFraction) => {
      const ctx = canvas.getContext('2d');
      const x = Math.floor(placement.x + placement.width * xFraction);
      const y = Math.floor(placement.y + placement.height * yFraction);
      return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
    };

    const outer = window.DuoExportCompositor.render({ scope: 'outer' });
    const inner = window.DuoExportCompositor.render({ scope: 'inner' });
    const both = window.DuoExportCompositor.renderBoth();

    return {
      preview: {
        outerPixel: await samplePng(outerPng, 0.5, 0.5),
        innerPixel: await samplePng(innerPng, 0.25, 0.4),
        fitPressed: document.querySelector('#fit-mode')?.getAttribute('aria-pressed'),
        crease: document.querySelector('#preview-workspace')?.dataset.crease,
        appIcons: document.querySelector('#preview-workspace')?.dataset.appIcons,
        outerSrc: document.querySelector('#outer-screen img')?.src,
        innerSrc: document.querySelector('#inner-screen img')?.src,
      },
      outer: {
        width: outer.canvas.width,
        height: outer.canvas.height,
        metadata: outer.metadata,
        pixel: sampleCanvas(outer.canvas, outer.metadata.placements.outer, 0.5, 0.5),
      },
      inner: {
        width: inner.canvas.width,
        height: inner.canvas.height,
        metadata: inner.metadata,
        pixel: sampleCanvas(inner.canvas, inner.metadata.placements.inner, 0.25, 0.4),
      },
      both: {
        metadata: both.metadata,
      },
    };
  }, { outerPng: outerShot.toString('base64'), innerPng: innerShot.toString('base64') });

  assert.equal(result.outer.width, 488, 'Outer-only export canvas width must wrap only Outer + 64px padding each side.');
  assert.equal(result.outer.height, 908, 'Outer-only export canvas height must wrap only Outer + 64px padding each side.');
  assert.deepEqual(Object.keys(result.outer.metadata.placements), ['outer'], 'Outer-only export must not place Inner.');
  assert.equal(result.outer.metadata.scope, 'outer');

  assert.equal(result.inner.width, 928, 'Inner-only export canvas width must wrap only Inner + 64px padding each side.');
  assert.equal(result.inner.height, 728, 'Inner-only export canvas height must wrap only Inner + 64px padding each side.');
  assert.deepEqual(Object.keys(result.inner.metadata.placements), ['inner'], 'Inner-only export must not place Outer.');
  assert.equal(result.inner.metadata.scope, 'inner');

  assert.equal(result.preview.fitPressed, 'true');
  assert.equal(result.outer.metadata.fitMode, 'fit');
  assert.equal(result.inner.metadata.fitMode, 'fit');
  assert.equal(result.both.metadata.fitMode, 'fit');
  assert.equal(result.preview.crease, 'on');
  assert.equal(result.preview.appIcons, 'on');
  assert.equal(result.inner.metadata.crease, true);
  assert.equal(result.inner.metadata.appIcons, true);
  assert.equal(result.both.metadata.crease, true);
  assert.equal(result.both.metadata.appIcons, true);

  assert.ok(result.preview.outerSrc?.startsWith('blob:'), 'Outer preview fixture must remain a local blob URL.');
  assert.ok(result.preview.innerSrc?.startsWith('blob:'), 'Inner preview fixture must remain a local blob URL.');

  closeRgb(result.outer.pixel, result.preview.outerPixel);
  closeRgb(result.inner.pixel, result.preview.innerPixel);

  const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
  assert.ok(geometry.body <= geometry.viewport, 'Export QA must not introduce horizontal overflow at 1024px.');
  await page.setViewportSize({ width: 320, height: 1000 });
  const mobileGeometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
  assert.ok(mobileGeometry.body <= mobileGeometry.viewport, 'Scoped export support must retain 320px no-overflow behavior.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T031/T032/T050 scoped export + preview parity QA passed with local representative fixtures and 320px regression guard.');
