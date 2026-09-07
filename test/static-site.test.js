const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const pages = [
  'index.html', 'mission.html', 'philosophy.html',
  'lp-quima.html', 'lp-soramoto.html', 'lp-mirai-keiba.html'
];

const senyoukiPage = 'senyouki.html';

test('Pasha uses its external landing page instead of a local page', () => {
  assert.equal(fs.existsSync(path.join(publicDir, 'lp-pasha.html')), false);
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /href="https:\/\/video-analyzer-5d8w\.onrender\.com"/);
});

test('every supplied page loads the shared preregistration form', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /href="preregister\.css"/, `${page} must load preregister.css`);
    assert.match(html, /src="preregister\.js"/, `${page} must load preregister.js`);
  }
});

test('all local image references resolve', () => {
  for (const page of [...pages, senyoukiPage]) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    const sources = [...html.matchAll(/(?:src|href)="((?:logo|assets)\/[^"?#]+)"/g)].map((match) => match[1]);
    for (const source of sources) {
      assert.ok(fs.existsSync(path.join(publicDir, source)), `${page}: missing ${source}`);
    }
  }
});

test('dedicated AI landing page meets content and conversion requirements', () => {
  const html = fs.readFileSync(path.join(publicDir, senyoukiPage), 'utf8');
  const visibleText = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/\s/g, '');

  assert.ok(visibleText.length >= 10_000, `visible copy is ${visibleText.length} characters`);
  assert.match(html, /href="https:\/\/pasyatto-for-sale\.com\//);
  assert.match(html, /href="https:\/\/quickmarketing-pro\.com\//);
  assert.match(html, /href="https:\/\/soramoto\.jp\//);
  assert.match(html, /href="lp-mirai-keiba\.html"/);
  assert.match(html, /@media\s*\(max-width:\s*720px\)/);
  assert.doesNotMatch(html, /蒸留|収束|反復|棄却|自己修正ループ|アルゴリズム|手法を学習|手法を吸収/);
});
