import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const widths = [375, 390, 430];
const expectedGutter = new Map([[375, 16], [390, 16], [430, 20]]);
const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="390" height="780" viewBox="0 0 390 780">
  <rect width="390" height="780" fill="#f2f4f7"/>
  <rect x="24" y="24" width="342" height="108" rx="22" fill="#cfd6df"/>
  <circle cx="80" cy="78" r="26" fill="#9aa5b1"/>
  <rect x="24" y="164" width="342" height="238" rx="22" fill="#dde3ea"/>
  <rect x="24" y="434" width="160" height="160" rx="22" fill="#c8d0da"/>
  <rect x="206" y="434" width="160" height="160" rx="22" fill="#d6dce4"/>
</svg>`);

const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    await page.setContent(html, { waitUntil: 'load' });

    const initial = await page.evaluate(() => {
      const shell = document.querySelector('main.shell').getBoundingClientRect();
      const toolbar = document.querySelector('.toolbar');
      const groups = [...document.querySelectorAll('.toolbar-group')].map((group) => {
        const rect = group.getBoundingClientRect();
        return {
          label: group.querySelector('.toolbar-label')?.textContent?.trim() || '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width
        };
      });
      const buttons = [...document.querySelectorAll('.toolbar button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { id: button.id, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      });
      const outer = document.querySelector('#outer-panel').getBoundingClientRect();
      const inner = document.querySelector('#inner-panel').getBoundingClientRect();
      const exportButton = document.querySelector('#export-button');
      const exportRect = exportButton.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        shellLeft: shell.left,
        shellRight: shell.right,
        toolbarClientWidth: toolbar.clientWidth,
        toolbarScrollWidth: toolbar.scrollWidth,
        groups,
        buttons,
        outer: { left: outer.left, right: outer.right, top: outer.top, bottom: outer.bottom },
        inner: { left: inner.left, right: inner.right, top: inner.top, bottom: inner.bottom },
        export: {
          left: exportRect.left,
          right: exportRect.right,
          top: exportRect.top,
          bottom: exportRect.bottom,
          height: exportRect.height,
          visible: getComputedStyle(exportButton).display !== 'none' && getComputedStyle(exportButton).visibility !== 'hidden',
          disabled: exportButton.disabled,
          ariaDisabled: exportButton.getAttribute('aria-disabled')
        }
      };
    });

    assert.equal(initial.viewport, width, `${width}px viewport must be applied exactly.`);
    assert.ok(initial.documentScrollWidth <= width, `${width}px must not create document horizontal overflow.`);
    assert.ok(initial.bodyScrollWidth <= width, `${width}px must not create body horizontal overflow.`);
    assert.ok(initial.toolbarScrollWidth <= initial.toolbarClientWidth + 1, `${width}px toolbar must not require horizontal scrolling.`);
    assert.ok(initial.shellLeft >= expectedGutter.get(width) - 1, `${width}px must keep the planned left mobile gutter.`);
    assert.ok(width - initial.shellRight >= expectedGutter.get(width) - 1, `${width}px must keep the planned right mobile gutter.`);

    assert.deepEqual(initial.groups.map(({ label }) => label), ['View', 'Image', 'Overlays', 'Actions'], `${width}px toolbar labels must remain unambiguous.`);
    for (const group of initial.groups) {
      assert.ok(group.left >= 0 && group.right <= width, `${width}px ${group.label} group must stay inside the viewport.`);
      assert.ok(group.width > 0, `${width}px ${group.label} group must retain usable width.`);
    }
    for (const button of initial.buttons) {
      assert.ok(button.left >= 0 && button.right <= width, `${width}px ${button.id} must stay inside the viewport.`);
      assert.ok(button.width > 0, `${width}px ${button.id} must retain usable width.`);
      assert.ok(button.height >= 44, `${width}px ${button.id} must keep a 44px minimum touch target.`);
    }

    assert.ok(initial.inner.top > initial.outer.top, `${width}px previews must remain stacked Outer then Inner.`);
    assert.ok(initial.outer.right <= width && initial.inner.right <= width, `${width}px preview panels must stay inside the viewport.`);

    if (width < 430) {
      for (let index = 1; index < initial.groups.length; index += 1) {
        assert.ok(initial.groups[index].top > initial.groups[index - 1].top, `${width}px must keep one labelled toolbar group per row.`);
      }
    } else {
      assert.ok(Math.abs(initial.groups[0].top - initial.groups[1].top) <= 1, '430px View and Image groups must share the first toolbar row.');
      assert.ok(Math.abs(initial.groups[2].top - initial.groups[3].top) <= 1, '430px Overlays and Actions groups must share the second toolbar row.');
      assert.ok(initial.groups[2].top > initial.groups[0].top, '430px toolbar second row must sit below the first row.');
    }

    assert.equal(initial.export.visible, true, `${width}px Export PNG CTA must remain visible.`);
    assert.ok(initial.export.left >= 0 && initial.export.right <= width, `${width}px Export PNG CTA must stay inside the viewport.`);
    assert.ok(initial.export.height >= 44, `${width}px Export PNG CTA must keep a 44px target.`);
    assert.ok(initial.export.bottom <= initial.outer.top + 1, `${width}px Export PNG CTA must not cover preview content.`);
    assert.equal(initial.export.disabled, false, `${width}px Export PNG CTA must be enabled after T039 implementation.`);
    assert.equal(initial.export.ariaDisabled, null, `${width}px enabled export must not expose aria-disabled=true.`);

    await page.locator('#fit-mode').click();
    await page.locator('#outer-upload').setInputFiles({ name: `outer-${width}.svg`, mimeType: 'image/svg+xml', buffer: svgBuffer });
    await page.locator('#outer-screen img').waitFor({ state: 'visible' });
    await page.locator('#inner-upload').setInputFiles({ name: `inner-${width}.svg`, mimeType: 'image/svg+xml', buffer: svgBuffer });
    await page.locator('#inner-screen img').waitFor({ state: 'visible' });

    const uploaded = await page.evaluate(() => ({
      outerSrc: document.querySelector('#outer-screen img')?.getAttribute('src') || '',
      innerSrc: document.querySelector('#inner-screen img')?.getAttribute('src') || '',
      outerFit: document.querySelector('#outer-screen img')?.dataset.fitMode,
      innerFit: document.querySelector('#inner-screen img')?.dataset.fitMode,
      viewMode: document.querySelector('#preview-workspace').dataset.viewMode,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth
    }));

    assert.ok(uploaded.outerSrc.startsWith('blob:'), `${width}px Outer upload must remain local.`);
    assert.ok(uploaded.innerSrc.startsWith('blob:'), `${width}px Inner upload must remain local.`);
    assert.equal(uploaded.outerFit, 'fit', `${width}px Outer preview must preserve Fit after upload.`);
    assert.equal(uploaded.innerFit, 'fit', `${width}px Inner preview must preserve Fit after upload.`);
    assert.equal(uploaded.viewMode, 'both', `${width}px must preserve Both mode after upload.`);
    assert.ok(uploaded.documentScrollWidth <= width && uploaded.bodyScrollWidth <= width, `${width}px uploads must not introduce overflow.`);

    await page.locator('#view-both').click();
    assert.match(await page.locator('#app-status').textContent(), /Both view active/i, `${width}px Both control must remain operable after uploads.`);

    await page.close();
  }
} finally {
  await browser.close();
}

console.log('T053 mobile QA passed at 375/390/430: stable layout, visible enabled export CTA, local uploads, and usable controls.');
