import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const widths = [320, 375, 768, 1024, 1440];
const expectedMinGutter = new Map([[320, 16], [375, 16], [768, 24], [1024, 24], [1440, 32]]);

const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.setContent(html, { waitUntil: 'load' });

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector('main.shell').getBoundingClientRect();
      const toolbar = document.querySelector('.toolbar');
      const outer = document.querySelector('#outer-panel').getBoundingClientRect();
      const inner = document.querySelector('#inner-panel').getBoundingClientRect();
      const fill = document.querySelector('#fill-mode').getBoundingClientRect();
      const workspaceStyle = getComputedStyle(document.querySelector('.workspace'));
      return {
        viewport: window.innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        shellLeft: shell.left,
        shellRight: shell.right,
        toolbarClientWidth: toolbar.clientWidth,
        toolbarScrollWidth: toolbar.scrollWidth,
        outer: { left: outer.left, right: outer.right, top: outer.top, bottom: outer.bottom },
        inner: { left: inner.left, right: inner.right, top: inner.top, bottom: inner.bottom },
        fillHeight: fill.height,
        columns: workspaceStyle.gridTemplateColumns
      };
    });

    assert.equal(metrics.viewport, width, `${width}px viewport must be applied exactly.`);
    assert.ok(metrics.documentScrollWidth <= width, `${width}px must not create document horizontal overflow.`);
    assert.ok(metrics.bodyScrollWidth <= width, `${width}px must not create body horizontal overflow.`);
    assert.ok(metrics.toolbarScrollWidth <= metrics.toolbarClientWidth + 1, `${width}px toolbar must not require horizontal scrolling.`);
    assert.ok(metrics.shellLeft >= expectedMinGutter.get(width) - 1, `${width}px shell must keep the planned minimum gutter.`);
    assert.ok(width - metrics.shellRight >= expectedMinGutter.get(width) - 1, `${width}px shell must keep the planned right gutter.`);
    assert.ok(metrics.fillHeight >= 44, `${width}px interactive controls must keep a 44px minimum target.`);

    if (width < 768) {
      assert.ok(metrics.inner.top > metrics.outer.top, `${width}px device previews must stack in one column.`);
      assert.ok(metrics.outer.right <= width && metrics.inner.right <= width, `${width}px stacked panels must stay inside the viewport.`);
    } else {
      assert.ok(Math.abs(metrics.inner.top - metrics.outer.top) <= 1, `${width}px device previews must align side-by-side.`);
      assert.ok(metrics.inner.left > metrics.outer.left, `${width}px Inner preview must occupy the second column.`);
    }

    await page.close();
  }
} finally {
  await browser.close();
}

console.log('Responsive shell browser QA passed at 320/375/768/1024/1440.');
