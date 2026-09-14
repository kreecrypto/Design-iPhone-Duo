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
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.addInitScript(() => {
      HTMLAnchorElement.prototype.click = function blockedDownload() {
        throw new Error('Simulated in-app browser download block');
      };
    });

    await page.goto(origin, { waitUntil: 'load' });
    const guidance = page.locator('#save-fallback-guidance');
    assert.equal(await guidance.count(), 1, 'Fallback guidance must be present after page initialization.');
    assert.equal(await guidance.isHidden(), true, 'Fallback guidance must stay hidden before a save failure.');

    await page.locator('#export-button').click();
    await page.waitForFunction(() => document.getElementById('app-status')?.textContent?.includes('could not be created'));
    await guidance.waitFor({ state: 'visible' });

    const text = (await guidance.textContent()) ?? '';
    assert.match(text, /open this page in Safari or Chrome/i, 'Failure guidance must tell users how to leave an in-app browser.');
    assert.match(text, /screenshots remain local/i, 'Fallback guidance must preserve the local-processing privacy promise.');
    assert.equal(await guidance.getAttribute('role'), 'note', 'Guidance must expose note semantics.');

    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      body: document.body.scrollWidth,
      guidanceRight: document.getElementById('save-fallback-guidance')?.getBoundingClientRect().right ?? 0
    }));
    assert.ok(layout.body <= layout.viewport, `Fallback must not cause horizontal overflow at ${width}px.`);
    assert.ok(layout.guidanceRight <= layout.viewport, `Fallback guidance must remain inside the ${width}px viewport.`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T040 in-app save fallback browser QA passed at 320/390: guidance stays hidden until a simulated save failure, then provides accessible Open-in-browser guidance without overflow.');
