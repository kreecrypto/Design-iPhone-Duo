import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const compositor = await readFile(new URL('../src/export-compositor.js', import.meta.url), 'utf8');
const outerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780"><rect width="360" height="780" fill="#c33"/></svg>');
const innerSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#36c"/></svg>');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.addScriptTag({ content: compositor });

  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: outerSvg });
  await page.locator('#outer-screen img').waitFor({ state: 'attached' });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: innerSvg });
  await page.locator('#inner-screen img').waitFor({ state: 'attached' });

  const result = await page.evaluate(() => {
    const exported = window.DuoExportCompositor.renderBoth();
    const { outer, inner } = exported.metadata.placements;
    const ctx = exported.canvas.getContext('2d');
    const outerPixel = Array.from(ctx.getImageData(outer.x + 60, outer.y + 100, 1, 1).data);
    const innerPixel = Array.from(ctx.getImageData(inner.x + 80, inner.y + 80, 1, 1).data);
    return {
      width: exported.canvas.width,
      height: exported.canvas.height,
      scope: exported.metadata.scope,
      outer,
      inner,
      gap: inner.x - (outer.x + outer.width),
      leftPad: outer.x,
      rightPad: exported.canvas.width - (inner.x + inner.width),
      outerTopPad: outer.y,
      outerBottomPad: exported.canvas.height - (outer.y + outer.height),
      innerTopPad: inner.y,
      innerBottomPad: exported.canvas.height - (inner.y + inner.height),
      outerPixel,
      innerPixel
    };
  });

  assert.equal(result.scope, 'both', 'Explicit Both export API must always compose both devices.');
  assert.equal(result.width, 1352, 'Both output must wrap Outer + 64px gap + Inner + 64px side padding.');
  assert.equal(result.height, 908, 'Both output height must wrap the taller Outer device + 64px vertical padding.');
  assert.equal(result.leftPad, 64, 'Both output must retain the left safe padding.');
  assert.equal(result.rightPad, 64, 'Both output must retain the right safe padding.');
  assert.equal(result.gap, 64, 'Both output must keep a stable inter-device gap.');
  assert.equal(result.outerTopPad, result.outerBottomPad, 'Outer must be vertically centered in the Both canvas.');
  assert.equal(result.innerTopPad, result.innerBottomPad, 'Inner must be vertically centered in the Both canvas.');
  assert.ok(result.outer.x < result.inner.x, 'Outer must remain left of Inner in the Both composition.');
  assert.ok(result.outerPixel[0] > result.outerPixel[2], 'Outer uploaded fixture must render into the Both output.');
  assert.ok(result.innerPixel[2] > result.innerPixel[0], 'Inner uploaded fixture must render into the Both output.');

  const privacy = await page.evaluate(() => ({
    outerSrc: document.querySelector('#outer-screen img')?.src,
    innerSrc: document.querySelector('#inner-screen img')?.src,
    hasFetch: /\bfetch\s*\(/.test(window.DuoExportCompositor.renderBoth.toString())
  }));
  assert.match(privacy.outerSrc ?? '', /^blob:/, 'Outer remains browser-local during Both export.');
  assert.match(privacy.innerSrc ?? '', /^blob:/, 'Inner remains browser-local during Both export.');
  assert.equal(privacy.hasFetch, false, 'Both export API must not introduce network image handling.');
} finally {
  await browser.close();
}

console.log('T030 Export Both browser QA passed: balanced canvas geometry, both fixture renders, and local-only sources verified.');
