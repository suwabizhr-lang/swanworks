const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const pages = [
  'index.html', 'mission.html', 'philosophy.html', 'lp-pasha.html',
  'lp-quima.html', 'lp-soramoto.html', 'lp-mirai-keiba.html'
];

test('every supplied page loads the shared preregistration form', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /href="preregister\.css"/, `${page} must load preregister.css`);
    assert.match(html, /src="preregister\.js"/, `${page} must load preregister.js`);
  }
});

test('all local image references resolve', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    const sources = [...html.matchAll(/(?:src|href)="((?:logo|assets)\/[^"?#]+)"/g)].map((match) => match[1]);
    for (const source of sources) {
      assert.ok(fs.existsSync(path.join(publicDir, source)), `${page}: missing ${source}`);
    }
  }
});
