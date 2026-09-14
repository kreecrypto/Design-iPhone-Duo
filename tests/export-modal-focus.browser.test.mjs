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

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, acceptDownloads: true });
    await page.goto(origin, { waitUntil: 'load' });

    const exportButton = page.locator('#export-button');
    const dialog = page.locator('#export-dialog');
    const closeButton = page.locator('#export-dialog-close');

    assert.equal(await dialog.count(), 1, 'Export dialog must be installed once.');
    assert.equal(await dialog.evaluate((node) => node.open), false, 'Export dialog must start closed.');

    await exportButton.focus();
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    await dialog.waitFor({ state: 'visible' });
    await downloadPromise;

    assert.equal(await dialog.evaluate((node) => node.open), true, 'Export action must open a modal dialog.');
    assert.equal(await dialog.getAttribute('aria-labelledby'), 'export-dialog-title');
    assert.equal(await dialog.getAttribute('aria-describedby'), 'export-dialog-description');
    assert.equal(await closeButton.evaluate((node) => node === document.activeElement), true, 'Initial focus must move inside the modal.');

    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true, 'Tab focus must remain trapped in the open modal.');
    }

    const geometry = await dialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewport: window.innerWidth, body: document.body.scrollWidth };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport, `Dialog must remain inside the ${width}px viewport.`);
    assert.ok(geometry.body <= geometry.viewport, `Dialog must not create horizontal overflow at ${width}px.`);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('export-dialog')?.open);
    await page.waitForFunction(() => document.activeElement?.id === 'export-button');
    assert.equal(await exportButton.evaluate((node) => node === document.activeElement), true, 'Escape close must restore focus to Export PNG.');

    const secondDownload = page.waitForEvent('download');
    await exportButton.click();
    await secondDownload;
    await closeButton.click();
    await page.waitForFunction(() => document.activeElement?.id === 'export-button');
    assert.equal(await exportButton.evaluate((node) => node === document.activeElement), true, 'Close button must restore focus to Export PNG.');

    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T043 export modal focus QA passed at 320/1024: modal focus stays contained, Escape/Close work, focus returns to Export PNG, and no horizontal overflow is introduced.');
