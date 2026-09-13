import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

assert.match(css, /:root\s*\{/);

const requiredTokens = [
  '--font-sans',
  '--font-size-xs',
  '--font-size-lg',
  '--space-1',
  '--space-6',
  '--space-9',
  '--touch-target-min',
  '--radius-control',
  '--radius-panel',
  '--radius-pill',
  '--color-page',
  '--color-surface',
  '--color-text',
  '--color-text-muted',
  '--color-border',
  '--color-device',
  '--color-focus',
  '--shadow-selected',
  '--shadow-device',
  '--shadow-focus',
  '--content-max',
  '--page-gutter-mobile',
  '--page-gutter-tablet',
  '--page-gutter-wide',
  '--breakpoint-mobile-s-max',
  '--breakpoint-mobile-max',
  '--breakpoint-tablet-max'
];

for (const token of requiredTokens) {
  assert.match(css, new RegExp(`${token.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*:`), `Missing token ${token}`);
}

assert.match(css, /--touch-target-min:\s*44px\s*;/);
assert.match(css, /--page-gutter-mobile:\s*16px\s*;/);
assert.match(css, /--breakpoint-mobile-s-max:\s*374px\s*;/);
assert.match(css, /--breakpoint-mobile-max:\s*767px\s*;/);
assert.match(css, /--breakpoint-tablet-max:\s*1023px\s*;/);
assert.match(css, /--focus-ring:\s*var\(--color-focus\)\s*;/);
assert.match(css, /--focus-halo:\s*var\(--color-focus-halo\)\s*;/);

console.log(`CSS token contract OK: ${requiredTokens.length} required tokens present.`);
