import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /class="outer-device-frame"[^>]*data-device-frame="outer"/, 'Outer hardware frame must exist');
assert.match(html, /id="outer-screen"[^>]*class="outer-device-screen"|class="outer-device-screen"[^>]*id="outer-screen"/, 'Outer clipped screen viewport must exist');
assert.match(html, /class="outer-device-safe-overlay"[^>]*aria-hidden="true"/, 'Decorative safe overlay must be hidden from assistive technology');
assert.match(html, /\.outer-device-screen\s*\{[^}]*overflow:\s*hidden/i, 'Outer screen must clip screenshot content');
assert.match(html, /\.outer-device-safe-overlay\s*\{[^}]*pointer-events:\s*none/i, 'Outer overlay must never intercept pointer input');
assert.match(html, /const outerScreen = document\.getElementById\('outer-screen'\)/, 'Outer render path must target the clipped screen viewport');
assert.match(html, /outerScreen\.replaceChildren\(image\)/, 'Loaded Outer screenshot must render inside the clipped viewport');

console.log('PASS outer-frame: original Outer hardware frame, clipping viewport, and pointer-safe overlay are present.');
