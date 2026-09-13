import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /class="inner-device-frame"[^>]*data-device-frame="inner"/, 'Inner unfolded hardware frame must exist');
assert.match(html, /id="inner-screen"[^>]*class="inner-device-screen"|class="inner-device-screen"[^>]*id="inner-screen"/, 'Inner clipped screen viewport must exist');
assert.match(html, /class="inner-device-hinge-safe-layer"[^>]*data-overlay="hinge-safe"[^>]*aria-hidden="true"/, 'Inner hinge-safe layer must exist and be decorative');
assert.match(html, /\.inner-device-screen\s*\{[^}]*overflow:\s*hidden/i, 'Inner screen must clip screenshot content');
assert.match(html, /\.inner-device-hinge-safe-layer\s*\{[^}]*pointer-events:\s*none/i, 'Inner hinge-safe layer must never intercept pointer input');
assert.match(html, /const innerScreen = document\.getElementById\('inner-screen'\)/, 'Inner render path must target the clipped screen viewport');
assert.match(html, /innerScreen\.replaceChildren\(image\)/, 'Loaded Inner screenshot must render inside the clipped viewport');
assert.match(html, /inner-device-frame[^\n]*aspect-ratio:\s*4\s*\/\s*3/i, 'Inner frame must use an unfolded landscape-oriented ratio');

console.log('PASS inner-frame: unfolded hardware frame, clipping viewport, and pointer-safe hinge layer are present.');
