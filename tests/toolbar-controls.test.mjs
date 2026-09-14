import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const mustMatch = (pattern, message) => assert.match(html, pattern, message);

mustMatch(/<div class="toolbar" role="toolbar" aria-label="Preview controls">/, 'Preview controls must expose a toolbar landmark.');
mustMatch(/class="toolbar-group" role="group" aria-label="Display mode"[\s\S]*?data-control-set="display"[\s\S]*?id="view-both"[^>]*aria-pressed="true"(?![^>]*disabled)[^>]*>Both<\/button>[\s\S]*?id="view-outer"[^>]*aria-pressed="false"[^>]*disabled[^>]*>Outer<\/button>[\s\S]*?id="view-inner"[^>]*aria-pressed="false"[^>]*disabled[^>]*>Inner<\/button>/, 'Display mode must expose implemented Both as selected/enabled while Outer and Inner remain disabled until T022/T023.');
mustMatch(/class="toolbar-group" role="group" aria-label="Image fit"[\s\S]*?data-control-set="fit"[\s\S]*?id="fill-mode"[^>]*aria-pressed="true"[^>]*>Fill<\/button>[\s\S]*?id="fit-mode"[^>]*aria-pressed="false"[^>]*>Fit<\/button>/, 'Fill/Fit must be a labelled single-selection control set with visible selected state.');
mustMatch(/class="toolbar-group" role="group" aria-label="Inner display overlays"[\s\S]*?id="crease-toggle"[^>]*role="switch"[^>]*aria-checked="false"(?![^>]*disabled)[^>]*>Crease<\/button>[\s\S]*?id="app-icons-toggle"[^>]*role="switch"[^>]*aria-checked="false"(?![^>]*disabled)[^>]*>App icons<\/button>/, 'Crease and App icons must both be enabled off-state switches after T024/T025 preview implementation.');
mustMatch(/id="clear-all" class="toolbar-action"[^>]*disabled[^>]*>Clear all<\/button>/, 'Clear all state must be represented and disabled until implemented.');
mustMatch(/id="export-button" class="toolbar-action toolbar-action--primary"[^>]*aria-describedby="export-description"[^>]*disabled[^>]*>Export PNG<\/button>/, 'Export must be represented as the toolbar primary CTA and remain disabled until implemented.');
mustMatch(/button \{ min-height: 44px; \}/, 'Toolbar controls must retain a minimum 44px touch target.');
mustMatch(/\.toolbar button\[aria-pressed="true"\]/, 'Selected segmented controls need an explicit visual state.');
mustMatch(/\.toolbar button:disabled/, 'Disabled controls need an explicit visual state.');

const exportButtonCount = (html.match(/id="export-button"/g) || []).length;
assert.equal(exportButtonCount, 1, 'Export toolbar control must have a single stable ID.');

console.log('Toolbar control structure and states verified.');
