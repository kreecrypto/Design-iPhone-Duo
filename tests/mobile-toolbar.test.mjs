import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mustMatch = (pattern, message) => assert.match(html, pattern, message);

mustMatch(/@media \(max-width: 767px\) \{[\s\S]*?\.shell \{ width: calc\(100% - 32px\); \}/, 'Mobile layout must keep a 16px page gutter.');
mustMatch(/@media \(max-width: 767px\) \{[\s\S]*?\.toolbar \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?overflow-x: visible;/, 'Mobile toolbar must wrap into grid rows instead of horizontal scrolling.');
mustMatch(/\.toolbar-group \{ width: 100%; min-width: 0; \}/, 'Mobile toolbar groups must be allowed to shrink within the viewport.');
mustMatch(/\.toolbar-controls \{ width: 100%; flex-wrap: wrap; \}/, 'Mobile toolbar controls must wrap within their group.');
mustMatch(/\.toolbar-segment \{ display: flex; width: 100%; \}/, 'Segmented controls must use the available mobile width.');
mustMatch(/\.toolbar-segment button \{ flex: 1 1 0; min-width: 0; padding-inline: 8px; \}/, 'Segmented buttons must share available mobile width without forcing overflow.');
mustMatch(/@media \(max-width: 374px\) \{\s*\.toolbar \{ grid-template-columns: 1fr; \}/, '320–374px toolbar must collapse to one unambiguous control group per row.');
mustMatch(/button \{ min-height: 44px; \}/, 'Touch controls must keep the 44px minimum target.');

assert.ok(!/@media \(max-width: 767px\)[\s\S]*?\.toolbar \{[^}]*overflow-x: auto/.test(html), 'Mobile toolbar must not require horizontal scrolling.');

console.log('Mobile toolbar wrapping and 320px structural guards verified.');
