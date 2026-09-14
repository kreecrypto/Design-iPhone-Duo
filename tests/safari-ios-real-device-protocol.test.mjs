import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const protocol = await readFile(new URL('../docs/SAFARI_IOS_REAL_DEVICE_QA.md', import.meta.url), 'utf8');

const requiredPhrases = [
  'physical iPhone',
  'Safari on the physical iPhone',
  'Outer fixture',
  'Inner fixture',
  'Both → Outer → Inner → Both',
  'Export PNG',
  'design-iphone-duo-both.png',
  'screenshots are not restored from persistent storage',
  'supporting evidence only',
  'does not replace this real-device gate'
];

for (const phrase of requiredPhrases) {
  assert.ok(protocol.includes(phrase), `T056 real-device protocol must include: ${phrase}`);
}

const requiredEvidenceFields = [
  '"task": "T056"',
  '"device":',
  '"ios":',
  '"browser": "Safari"',
  '"testedUrl":',
  '"commit":',
  '"testedAt":',
  '"outerUpload":',
  '"innerUpload":',
  '"stateSwitching":',
  '"responsiveNoHorizontalOverflow":',
  '"exportPath":',
  '"pngFilename":',
  '"pngContentVerified":',
  '"screenshotsNotPersistedAfterReload":',
  '"notes":'
];

for (const field of requiredEvidenceFields) {
  assert.ok(protocol.includes(field), `T056 evidence contract must include ${field}`);
}

assert.match(protocol, /Do not treat an in-app browser, desktop Safari responsive mode, simulator, Playwright WebKit, Chrome on iOS, or a user-agent override as equivalent/i);
assert.match(protocol, /Never use private\/customer screenshots for QA evidence/i);
assert.match(protocol, /Do not commit device identifiers, Apple IDs, IP addresses, private photos, customer data, or uploaded user screenshots/i);

console.log('T056 real-device QA protocol guard passed: physical-Safari gate, upload/export/fallback acceptance, privacy, and evidence contract are explicit.');
