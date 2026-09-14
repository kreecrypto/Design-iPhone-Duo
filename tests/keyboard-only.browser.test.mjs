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

    const requiredViewControls = ['#view-both', '#view-outer', '#view-inner'];
    for (const selector of requiredViewControls) {
      const control = page.locator(selector);
      assert.equal(await control.count(), 1, `${selector} must exist.`);
      assert.equal(await control.isEnabled(), true, `${selector} must be keyboard-operable for T060.`);
    }

    const keyboardControls = [
      '#view-both', '#view-outer', '#view-inner',
      '#fill-mode', '#fit-mode', '#crease-toggle', '#app-icons-toggle',
      '#outer-upload', '#inner-upload', '#export-button'
    ];

    await page.locator('#view-both').focus();
    for (const selector of keyboardControls) {
      const expected = page.locator(selector);
      await expected.focus();
      assert.equal(await expected.evaluate((node) => node === document.activeElement), true, `${selector} must accept keyboard focus.`);
      const visibleFocus = await expected.evaluate((node) => {
        const style = getComputedStyle(node);
        return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2;
      });
      assert.equal(visibleFocus, true, `${selector} must expose a visible focus indicator.`);
    }

    await page.locator('#view-outer').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#view-outer').getAttribute('aria-pressed'), 'true', 'Enter must activate Outer mode.');
    assert.equal(await page.locator('#outer-panel').evaluate((node) => node.hidden), false, 'Outer panel must remain visible in Outer mode.');
    assert.equal(await page.locator('#inner-panel').evaluate((node) => node.hidden), true, 'Inner panel must hide in Outer mode.');

    await page.locator('#view-inner').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#view-inner').getAttribute('aria-pressed'), 'true', 'Space must activate Inner mode.');
    assert.equal(await page.locator('#outer-panel').evaluate((node) => node.hidden), true, 'Outer panel must hide in Inner mode.');
    assert.equal(await page.locator('#inner-panel').evaluate((node) => node.hidden), false, 'Inner panel must remain visible in Inner mode.');

    await page.locator('#view-both').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#view-both').getAttribute('aria-pressed'), 'true');

    await page.locator('#fit-mode').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fit-mode').getAttribute('aria-pressed'), 'true', 'Fit must activate from keyboard.');

    await page.locator('#crease-toggle').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#crease-toggle').getAttribute('aria-checked'), 'true', 'Crease switch must toggle from keyboard.');

    await page.locator('#app-icons-toggle').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#app-icons-toggle').getAttribute('aria-checked'), 'true', 'App icons switch must toggle from keyboard.');

    const exportButton = page.locator('#export-button');
    await exportButton.focus();
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    await downloadPromise;
    const dialog = page.locator('#export-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true, 'Export dialog must receive keyboard focus.');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.id === 'export-button');

    const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
    assert.ok(geometry.body <= geometry.viewport, `Keyboard interactions must not introduce overflow at ${width}px.`);

    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('T060 keyboard-only QA passed at 320/1024: view/fit/overlay/export controls are keyboard-operable with visible focus and modal focus restoration.');
