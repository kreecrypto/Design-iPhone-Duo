import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const compositor = await readFile(new URL('../src/export-compositor.js', import.meta.url), 'utf8');
const outerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780"><rect width="360" height="780" fill="#cc2233"/></svg>');
const innerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#2255cc"/></svg>');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.addScriptTag({ content: compositor });

  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#outer-screen img').waitFor({ state: 'attached' });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.locator('#inner-screen img').waitFor({ state: 'attached' });
  await page.locator('#fit-mode').click();
  await page.locator('#crease-toggle').click();
  await page.locator('#app-icons-toggle').click();

  const results = await page.evaluate(() => {
    function pixel(canvas, x, y) {
      return Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data);
    }
    const both = window.DuoExportCompositor.render({ scope: 'both' });
    const outer = window.DuoExportCompositor.render({ scope: 'outer' });
    const inner = window.DuoExportCompositor.render({ scope: 'inner' });
    const innerPlacement = both.metadata.placements.inner;
    const outerPlacement = both.metadata.placements.outer;
    return {
      both: {
        width: both.canvas.width,
        height: both.canvas.height,
        metadata: both.metadata,
        outerPixel: pixel(both.canvas, outerPlacement.x + 60, outerPlacement.y + 100),
        innerPixel: pixel(both.canvas, innerPlacement.x + 80, innerPlacement.y + 80),
        creasePixel: pixel(both.canvas, innerPlacement.x + innerPlacement.width / 2, innerPlacement.y + 120),
        dockPixel: pixel(both.canvas, innerPlacement.x + innerPlacement.width / 2, innerPlacement.y + innerPlacement.height - 60)
      },
      outer: { width: outer.canvas.width, height: outer.canvas.height, metadata: outer.metadata },
      inner: { width: inner.canvas.width, height: inner.canvas.height, metadata: inner.metadata }
    };
  });

  assert.equal(results.both.width, 1352, 'Both compositor canvas must wrap Outer + gap + Inner + safe padding.');
  assert.equal(results.both.height, 908, 'Both compositor height must wrap the taller Outer device + safe padding.');
  assert.equal(results.both.metadata.scope, 'both');
  assert.equal(results.both.metadata.fitMode, 'fit', 'Compositor must reflect current Fit state.');
  assert.equal(results.both.metadata.crease, true, 'Compositor must reflect current Crease state.');
  assert.equal(results.both.metadata.appIcons, true, 'Compositor must reflect current App icons state.');
  assert.deepEqual(Object.keys(results.both.metadata.placements), ['outer', 'inner']);
  assert.ok(results.both.metadata.placements.outer.x < results.both.metadata.placements.inner.x, 'Outer must render before Inner in Both composition.');

  assert.ok(results.both.outerPixel[0] > results.both.outerPixel[2], 'Outer fixture color must be rendered into the export canvas.');
  assert.ok(results.both.innerPixel[2] > results.both.innerPixel[0], 'Inner fixture color must be rendered into the export canvas.');
  assert.notDeepEqual(results.both.creasePixel.slice(0, 3), results.both.innerPixel.slice(0, 3), 'Enabled crease must change exported Inner center pixels.');
  assert.ok(results.both.dockPixel[0] > results.both.innerPixel[0], 'Enabled app icon dock must appear in exported Inner pixels.');

  assert.equal(results.outer.width, 488);
  assert.equal(results.outer.height, 908);
  assert.deepEqual(Object.keys(results.outer.metadata.placements), ['outer'], 'Outer scope must contain only the Outer placement.');
  assert.equal(results.inner.width, 928);
  assert.equal(results.inner.height, 728);
  assert.deepEqual(Object.keys(results.inner.metadata.placements), ['inner'], 'Inner scope must contain only the Inner placement.');

  const privacy = await page.evaluate(() => ({
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    hasFetch: /\bfetch\s*\(/.test(window.DuoExportCompositor.render.toString())
  }));
  assert.match(privacy.outerSrc ?? '', /^blob:/, 'Outer source remains a local blob URL.');
  assert.match(privacy.innerSrc ?? '', /^blob:/, 'Inner source remains a local blob URL.');
  assert.equal(privacy.hasFetch, false, 'Compositor render path must not fetch image content.');
} finally {
  await browser.close();
}

console.log('T029 export compositor browser QA passed: Both/Outer/Inner scopes, Fit state, overlay parity, fixture pixels, and local-only rendering verified.');
