const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const pages = [
  'index.html', 'mission.html', 'philosophy.html',
  'lp-mirai-keiba.html'
];
const senyoukiPages = [
  'senyouki.html', 'senyouki-v2.html', 'senyouki-v3.html'
];

test('retired product landing pages permanently redirect to canonical LPs', async (t) => {
  const server = require('../src/server').listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (const [slug, destination] of [
    ['lp-quima', 'https://quickmarketing-pro.com/lp.html'],
    ['lp-soramoto', 'https://soramoto.jp/lp.html']
  ]) {
    assert.equal(fs.existsSync(path.join(publicDir, `${slug}.html`)), false);
    for (const suffix of ['.html', '']) {
      for (const query of ['', '?utm_source=qr&utm_campaign=spring%20sale']) {
        for (const method of ['GET', 'HEAD']) {
          const response = await fetch(`${baseUrl}/${slug}${suffix}${query}`, {
            method, redirect: 'manual'
          });
          assert.equal(response.status, 301);
          assert.equal(response.headers.get('location'), destination + query);
          await response.text();
        }
      }
    }
  }
  const remaining = await fetch(`${baseUrl}/lp-mirai-keiba.html`);
  assert.equal(remaining.status, 200);
  assert.match(await remaining.text(), /未来競馬/);
});

test('public files contain no links to retired landing pages', () => {
  for (const file of fs.readdirSync(publicDir, { recursive: true })) {
    if (!/\.(html|css|js|svg|xml|txt|json)$/.test(file)) continue;
    const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.doesNotMatch(content, /lp-(?:quima|soramoto)\.html/, file);
  }
});

test('homepage product cards and footer link to the official destinations', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  for (const destination of [
    'https://pasyatto-for-sale.com/lp.html',
    'https://quickmarketing-pro.com/lp.html',
    'https://soramoto.jp/lp.html'
  ]) {
    assert.equal(home.split(`href="${destination}"`).length - 1, 2, destination);
  }
  assert.ok(!home.includes('href="https://quickmarketing-pro.com/"'));
});

test('Pasha uses its production landing page instead of a local page', () => {
  assert.equal(fs.existsSync(path.join(publicDir, 'lp-pasha.html')), false);
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /href="https:\/\/pasyatto-for-sale\.com\/lp\.html"/);
});

test('homepage prioritizes live products while keeping preregistration secondary', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /href="#business">公開中のアプリを見る<\/a>/);
  assert.match(home, /<section id="contact"[\s\S]*公開中のアプリを使ってみる[\s\S]*href="#business"[\s\S]*href="#preregister"/);
  assert.match(home, /公開中の製品は今すぐお使いいただけます。/);
  assert.match(home, /準備中・今後登場する製品/);
});

test('homepage preserves preregistration DOM, behavior, and CTA tracking', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /<form class="preregister" data-preregister-form novalidate>/);
  assert.match(home, /data-preregister-products/);
  assert.match(home, /name="source" type="hidden" value="index"/);
  assert.match(home, /<script src="preregister\.js" defer><\/script>/);
  assert.match(home, /<script src="ga4-events\.js" defer><\/script>/);
  assert.match(home, /<body data-ga4-variant="homepage-v2">/);
});

test('homepage exposes the four official social links', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const links = [
    'https://www.instagram.com/swan.works/',
    'https://www.threads.net/@swan.works',
    'https://x.com/swanworks_jp',
    'https://lin.ee/wwPFt0xR'
  ];
  for (const href of links) {
    assert.ok(home.includes(`href="${href}"`), `index.html: missing SNS link ${href}`);
  }
});

test('homepage links to privacy policy and terms pages', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /href="privacy\.html"/);
  assert.match(home, /href="terms\.html"/);
  assert.ok(fs.existsSync(path.join(publicDir, 'privacy.html')));
  assert.ok(fs.existsSync(path.join(publicDir, 'terms.html')));

  const privacy = fs.readFileSync(path.join(publicDir, 'privacy.html'), 'utf8');
  assert.match(privacy, /Google API Services User Data Policy/);
  assert.match(privacy, /Limited Use/);
  assert.match(privacy, /メールは自動送信しません/);

  const terms = fs.readFileSync(path.join(publicDir, 'terms.html'), 'utf8');
  assert.match(terms, /href="privacy\.html"/);
});

test('homepage and remaining product LP load shared preregistration assets', () => {
  for (const page of ['index.html', 'lp-mirai-keiba.html']) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /href="preregister\.css"/, `${page} must load preregister.css`);
    assert.match(html, /src="preregister\.js"/, `${page} must load preregister.js`);
  }
});

test('all local image references resolve', () => {
  for (const page of [...pages, ...senyoukiPages]) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    const sources = [...html.matchAll(/(?:src|href)="((?:logo|assets|lp-assets)\/[^"?#]+)"/g)].map((match) => match[1]);
    for (const source of sources) {
      assert.ok(fs.existsSync(path.join(publicDir, source)), `${page}: missing ${source}`);
    }
  }
});

test('three senyouki variants keep their production paths and required CTA links', () => {
  const requiredLinks = [
    'https://pasyatto-for-sale.com/',
    'https://quickmarketing-pro.com/',
    'https://soramoto.jp/'
  ];

  for (const page of senyoukiPages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /<meta name="viewport" content="[^"]*width=device-width/);
    assert.match(html, /href="(?:index\.html|https:\/\/swanworks\.jp\/)"/);
    for (const href of requiredLinks) {
      assert.ok(html.includes(`href="${href}"`), `${page}: missing CTA ${href}`);
    }
  }
});

test('three senyouki variants load CTA tracking with the correct variant', () => {
  const variants = ['v1', 'v2', 'v3'];
  for (const [index, page] of senyoukiPages.entries()) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, new RegExp(`<body[^>]*data-ga4-variant="${variants[index]}"`));
    assert.match(html, /<script src="ga4-events\.js" defer><\/script>/);
  }

  const tracker = fs.readFileSync(path.join(publicDir, 'ga4-events.js'), 'utf8');
  assert.match(tracker, /'select_product'/);
  assert.match(tracker, /variant,/);
  assert.match(tracker, /product,/);
  assert.match(tracker, /destination_url: destination\.href/);
  assert.match(tracker, /'pasyatto-for-sale\.com': 'pasyatto'/);
  assert.match(tracker, /'quickmarketing-pro\.com': 'quima'/);
  assert.match(tracker, /'soramoto\.jp': 'soramoto'/);
});

test('senyouki publication does not replace preregistration integration', () => {
  assert.ok(fs.existsSync(path.join(publicDir, 'preregister.js')));
  assert.ok(fs.existsSync(path.join(publicDir, 'preregister.css')));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /(?:href|src)="preregister\.(?:css|js)"/);
  }
});
