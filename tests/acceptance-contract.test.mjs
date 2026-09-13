import fs from 'node:fs';
import assert from 'node:assert/strict';

const doc = fs.readFileSync(new URL('../docs/SUCCESS_CRITERIA.md', import.meta.url), 'utf8');

const ids = Array.from({ length: 10 }, (_, index) => `AC-${String(index + 1).padStart(3, '0')}`);
for (const id of ids) assert.match(doc, new RegExp(`\\| ${id} \\|`), `${id} must exist in the repo acceptance contract`);

for (const required of [
  'without sending image bytes to a server',
  'never loses loaded images during the session',
  'never distort aspect ratio',
  'PNG output matches chosen scope',
  '320px width without horizontal scrolling',
  'browser fallback guidance',
  'keyboard operable with visible focus',
  'No uploaded screenshot bytes are persisted in localStorage/IndexedDB by default',
  'not an official Apple product',
  'MVP release is blocked until every P0 criterion above has passing evidence',
]) assert.ok(doc.includes(required), `Missing acceptance contract clause: ${required}`);

assert.equal(new Set(ids.filter((id) => doc.includes(`| ${id} |`))).size, 10, 'All 10 acceptance IDs must be unique/present');
console.log('PASS: MVP acceptance contract contains AC-001..AC-010 and release/evidence rules.');
