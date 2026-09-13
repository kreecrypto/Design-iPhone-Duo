import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="640" viewBox="0 0 320 640">
  <rect width="320" height="640" fill="#f2f4f7"/>
  <rect x="24" y="24" width="272" height="96" rx="20" fill="#cfd6df"/>
  <circle cx="72" cy="72" r="24" fill="#9aa5b1"/>
  <rect x="24" y="152" width="272" height="200" rx="20" fill="#dde3ea"/>
  <rect x="24" y="384" width="128" height="128" rx="20" fill="#c8d0da"/>
  <rect x="168" y="384" width="128" height="128" rx="20" fill="#d6dce4"/>
</svg>`);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 1200 } });
  await page.setContent(html, { waitUntil: 'load' });

  const initial = await page.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const shell = document.querySelector('main.shell').getBoundingClientRect();
    const toolbarButtons = [...document.querySelectorAll('.toolbar button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        id: button.id,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        disabled: button.disabled
      };
    });
    const toolbarGroups = [...document.querySelectorAll('.toolbar-group')].map((group) => {
      const rect = group.getBoundingClientRect();
      const label = group.querySelector('.toolbar-label');
      return {
        label: label?.textContent?.trim(),
        left: rect.left,
        right: rect.right,
        width: rect.width,
        labelVisible: !!label && getComputedStyle(label).display !== 'none'
      };
    });
    return {
      viewport: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      shellLeft: shell.left,
      shellRight: shell.right,
      toolbarClientWidth: toolbar.clientWidth,
      toolbarScrollWidth: toolbar.scrollWidth,
      toolbarButtons,
      toolbarGroups
    };
  });

  assert.equal(initial.viewport, 320, 'T052 must run at an exact 320px viewport.');
  assert.ok(initial.documentScrollWidth <= 320, '320px QA must have no document-level horizontal overflow.');
  assert.ok(initial.bodyScrollWidth <= 320, '320px QA must have no body horizontal overflow.');
  assert.ok(initial.toolbarScrollWidth <= initial.toolbarClientWidth + 1, 'Toolbar must not require horizontal scrolling at 320px.');
  assert.ok(initial.shellLeft >= 15 && 320 - initial.shellRight >= 15, 'Main shell must keep the planned ~16px mobile gutter.');

  assert.deepEqual(initial.toolbarGroups.map(({ label }) => label), ['View', 'Image', 'Overlays', 'Actions'], 'Toolbar groups must remain unambiguous at 320px.');
  for (const group of initial.toolbarGroups) {
    assert.ok(group.labelVisible, `${group.label} label must remain visible at 320px.`);
    assert.ok(group.left >= 0 && group.right <= 320, `${group.label} group must stay inside the viewport.`);
    assert.ok(group.width > 0, `${group.label} group must retain usable width.`);
  }
  for (const button of initial.toolbarButtons) {
    assert.ok(button.left >= 0 && button.right <= 320, `${button.id} must stay inside the viewport.`);
    assert.ok(button.width > 0, `${button.id} must retain usable width.`);
    assert.ok(button.height >= 44, `${button.id} must keep a 44px minimum touch target.`);
  }

  assert.equal(await page.locator('#view-both').isEnabled(), true, 'Both control must be usable at 320px.');
  assert.equal(await page.locator('#fill-mode').isEnabled(), true, 'Fill control must be usable at 320px.');
  assert.equal(await page.locator('#fit-mode').isEnabled(), true, 'Fit control must be usable at 320px.');

  await page.locator('#fit-mode').click();
  assert.equal(await page.locator('#fit-mode').getAttribute('aria-pressed'), 'true', 'Fit must become selected by touch/click interaction.');
  assert.equal(await page.locator('#fill-mode').getAttribute('aria-pressed'), 'false', 'Fill must deselect when Fit becomes active.');

  await page.locator('#outer-upload').setInputFiles({ name: 'outer.svg', mimeType: 'image/svg+xml', buffer: svgBuffer });
  await page.locator('#outer-screen img').waitFor({ state: 'visible' });
  await page.locator('#inner-upload').setInputFiles({ name: 'inner.svg', mimeType: 'image/svg+xml', buffer: svgBuffer });
  await page.locator('#inner-screen img').waitFor({ state: 'visible' });

  const uploaded = await page.evaluate(() => ({
    outerSrc: document.querySelector('#outer-screen img')?.getAttribute('src') || '',
    innerSrc: document.querySelector('#inner-screen img')?.getAttribute('src') || '',
    outerFit: document.querySelector('#outer-screen img')?.dataset.fitMode,
    innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode,
    outerVisible: !document.querySelector('#outer-panel').hidden,
    innerVisible: !document.querySelector('#inner-panel').hidden,
    viewMode: document.querySelector('#preview-workspace').dataset.viewMode,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));

  assert.ok(uploaded.outerSrc.startsWith('blob:'), 'Outer upload must stay on a local blob URL at 320px.');
  assert.ok(uploaded.innerSrc.startsWith('blob:'), 'Inner upload must stay on a local blob URL at 320px.');
  assert.equal(uploaded.outerFit, 'fit', 'Outer preview must preserve the selected Fit state after upload.');
  assert.equal(uploaded.innerFit, 'fit', 'Inner preview must preserve the selected Fit state after upload.');
  assert.equal(uploaded.outerVisible, true, 'Outer preview must remain visible in Both mode.');
  assert.equal(uploaded.innerVisible, true, 'Inner preview must remain visible in Both mode.');
  assert.equal(uploaded.viewMode, 'both', '320px QA must preserve Both view mode.');
  assert.ok(uploaded.documentScrollWidth <= 320 && uploaded.bodyScrollWidth <= 320, 'Uploads must not introduce horizontal overflow at 320px.');

  await page.locator('#view-both').click();
  assert.match(await page.locator('#app-status').textContent(), /Both view active/i, 'Both control must remain operable after uploads.');

  await page.close();
} finally {
  await browser.close();
}

console.log('T052 320px viewport QA passed: no overflow, controls usable, and local uploads remain functional.');
