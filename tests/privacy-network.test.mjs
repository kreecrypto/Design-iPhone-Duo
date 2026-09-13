import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const uploadSectionStart = html.indexOf("const outerInput = document.getElementById('outer-upload')");
assert.notEqual(uploadSectionStart, -1, 'Upload implementation must exist');

const uploadImplementation = html.slice(uploadSectionStart);

const forbiddenNetworkPatterns = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bnavigator\.sendBeacon\b/, 'navigator.sendBeacon()'],
  [/\bFormData\b/, 'FormData'],
];

for (const [pattern, label] of forbiddenNetworkPatterns) {
  assert.equal(
    pattern.test(uploadImplementation),
    false,
    `Screenshot upload flow must not use ${label}`,
  );
}

assert.match(
  uploadImplementation,
  /URL\.createObjectURL\(file\)/,
  'Screenshot previews must use local object URLs',
);

assert.match(
  uploadImplementation,
  /URL\.revokeObjectURL\(/,
  'Object URLs must be revoked when replaced or cleared',
);

assert.equal(
  /localStorage\.(?:setItem|getItem)\s*\([^)]*(?:outer|inner|image|screenshot)/i.test(uploadImplementation),
  false,
  'Screenshot data must not be persisted in localStorage',
);

assert.equal(
  /indexedDB\.(?:open|deleteDatabase)\s*\(/.test(uploadImplementation),
  false,
  'Screenshot data must not be persisted in IndexedDB',
);

console.log('PASS privacy-network: screenshot handling is local-only and contains no network upload primitive.');
