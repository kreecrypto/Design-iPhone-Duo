import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const expectedTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const inputAcceptMatches = [...html.matchAll(/<input[^>]+type="file"[^>]+accept="([^"]+)"[^>]*>/g)];
assert.equal(inputAcceptMatches.length, 2, 'Outer and Inner file inputs must both exist');

for (const match of inputAcceptMatches) {
  const accepted = new Set(match[1].split(',').map((value) => value.trim()));
  for (const mimeType of expectedTypes) {
    assert.equal(accepted.has(mimeType), true, `File input accept list must include ${mimeType}`);
  }
}

const allowlistMatch = html.match(/const allowedImageTypes = new Set\(\[([^\]]+)\]\);/);
assert.ok(allowlistMatch, 'JavaScript MIME allowlist must exist');

const allowlist = new Set(
  [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]),
);

for (const mimeType of expectedTypes) {
  assert.equal(allowlist.has(mimeType), true, `Runtime MIME allowlist must include ${mimeType}`);
}

assert.match(html, /validateImageFile\(file, 'Outer', outerInput\)/, 'Outer upload must pass through MIME validation');
assert.match(html, /validateImageFile\(file, 'Inner', innerInput\)/, 'Inner upload must pass through MIME validation');
assert.match(html, /URL\.createObjectURL\(file\)/, 'Supported uploads must remain local object URLs');

console.log('PASS upload-matrix: PNG, JPEG, WebP, GIF, and SVG are accepted consistently by both inputs and runtime validation.');
