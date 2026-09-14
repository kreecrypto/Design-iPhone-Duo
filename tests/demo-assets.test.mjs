import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixtures = [
  { path: 'public/demo/outer-demo.svg', width: '1080', height: '2340', name: 'Outer' },
  { path: 'public/demo/inner-demo.svg', width: '1600', height: '1200', name: 'Inner' },
];

for (const fixture of fixtures) {
  assert.ok(fs.existsSync(fixture.path), `${fixture.name} synthetic fixture must exist`);
  const svg = fs.readFileSync(fixture.path, 'utf8');
  assert.match(svg, /^<svg[\s\S]*<\/svg>\s*$/m, `${fixture.name} fixture must be standalone SVG`);
  assert.match(svg, new RegExp(`width="${fixture.width}"`), `${fixture.name} fixture width must be stable`);
  assert.match(svg, new RegExp(`height="${fixture.height}"`), `${fixture.name} fixture height must be stable`);
  assert.match(svg, /<title id="title">/, `${fixture.name} fixture must have an accessible title`);
  assert.match(svg, /<desc id="desc">/, `${fixture.name} fixture must have an accessible description`);
  assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["'](?:https?:|data:|blob:)/i, `${fixture.name} fixture must not reference external or embedded URLs`);
  assert.doesNotMatch(svg, /<(?:image|script|foreignObject)\b/i, `${fixture.name} fixture must contain vector-only inert markup`);
  assert.ok((svg.match(/<rect\b/g) ?? []).length >= 10, `${fixture.name} fixture must contain meaningful synthetic UI geometry`);
}

console.log('Synthetic demo asset checks passed.');
