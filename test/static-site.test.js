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

test('homepage provides the contact form and all planned products', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /<section id="contact"[\s\S]*data-contact-form[\s\S]*name="name"[\s\S]*name="email"[\s\S]*name="type"[\s\S]*name="message"[\s\S]*aria-live="polite"/);
  assert.match(home, /<script src="contact\.js" defer><\/script>/);
  for (const product of ['VoiceKey', 'ソバイル（Sobail）', 'エマイア（EMAIA）', 'AI営業提案システム（仮称：提案すごい君）']) {
    assert.match(home, new RegExp(product.replace(/[()（）]/g, '\\$&')));
  }

  const mission = fs.readFileSync(path.join(publicDir, 'mission.html'), 'utf8');
  assert.match(mission, /href="index\.html#contact">お問い合わせ・ご意見はこちら/);
  assert.doesNotMatch(mission, /mailto:swanworks\.jp@gmail\.com/);
});

test('preregistration choices contain the current product lineup', () => {
  const script = fs.readFileSync(path.join(publicDir, 'preregister.js'), 'utf8');
  assert.doesNotMatch(script, /MIMAMORO/);
  for (const product of ['ソバイル（Sobail）', 'エマイア（EMAIA）', 'AI営業提案システム（仮称：提案すごい君）']) {
    assert.match(script, new RegExp(product.replace(/[()（）]/g, '\\$&')));
  }
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

test('affiliate landing page and terms are served from extensionless and html paths with GA4', async (t) => {
  const previousMeasurementId = process.env.GA4_MEASUREMENT_ID;
  process.env.GA4_MEASUREMENT_ID = 'G-ABC123DEF4';
  const server = require('../src/server').listen(0);
  t.after(() => {
    server.close();
    if (previousMeasurementId === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = previousMeasurementId;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const route of ['/lp-affiliate', '/lp-affiliate.html']) {
    const response = await fetch(baseUrl + route, { redirect: 'manual' });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /創業アンバサダーを、/);
    assert.match(html, /先着100名/);
    assert.match(html, /href="affiliate-terms\.html"/);
    assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-ABC123DEF4/);
  }

  for (const route of ['/affiliate-terms', '/affiliate-terms.html']) {
    const response = await fetch(baseUrl + route, { redirect: 'manual' });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /創業アンバサダー・プログラム利用規約/);
    assert.match(html, /第10条（免責・変更・準拠法）/);
    assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-ABC123DEF4/);
  }
});

test('affiliate landing page has ordered product CTAs, consent link, and inline GA4 tracking', () => {
  const html = fs.readFileSync(path.join(publicDir, 'lp-affiliate.html'), 'utf8');
  const destinations = [
    'https://pasyatto-for-sale.com/affiliate.html',
    'https://soramoto.jp/affiliate.html',
    'https://quickmarketing-pro.com/affiliate.html'
  ];
  let previousIndex = -1;
  for (const destination of destinations) {
    const index = html.indexOf(`href="${destination}"`);
    assert.ok(index > previousIndex, `missing or incorrectly ordered CTA: ${destination}`);
    previousIndex = index;
  }
  assert.match(html, /登録時に[\s\S]*href="affiliate-terms\.html"[\s\S]*への同意が必要/);
  assert.match(html, /'event','affiliate_cta'/);
  assert.match(html, /product:link\.dataset\.product/);
  assert.doesNotMatch(html, /src="ga4-events\.js"/);

  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(home, /href="lp-affiliate\.html">創業アンバサダー募集/);
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
    'https://pasyatto-for-sale.com/lp.html',
    'https://quickmarketing-pro.com/lp.html',
    'https://soramoto.jp/lp.html'
  ];

  for (const page of senyoukiPages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /<meta name="viewport" content="[^"]*width=device-width/);
    assert.match(html, /href="(?:index\.html|https:\/\/swanworks\.jp\/)"/);
    for (const href of requiredLinks) {
      assert.ok(html.includes(`href="${href}"`), `${page}: missing CTA ${href}`);
    }
    assert.match(html, /href="#products"[^>]*>[^<]*(?:選ぶ|見る|試す)/, `${page}: missing hero CTA`);
    assert.match(html, /初期費用0円/);
    assert.match(html, /月額サブスク/);
    assert.match(html, /いつでも解約/);
    assert.match(html, /無料枠はカード不要/);
    assert.match(html, /運営者/);
    assert.match(html, /¥980〜/);
    assert.match(html, /無料〜/);
    assert.match(html, /初月¥2,980〜/);
    assert.match(html, /¥2,980〜/);
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

test('senyouki v2 and v3 header CTAs stay on one line on mobile', () => {
  for (const page of ['senyouki-v2.html', 'senyouki-v3.html']) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /\.nav-cta\{[^}]*white-space:nowrap[^}]*\}/, `${page}: header CTA must not wrap`);
    assert.match(html, /@media\(max-width:720px\)\{[^\n]*\.nav-cta\{font-size:\.7rem;padding:7px 12px\}/, `${page}: header CTA must be compact on mobile`);
    assert.match(html, /<a class="nav-cta" href="#products">専用機を見る<\/a>/, `${page}: header CTA must use the compact label`);
  }
});

test('senyouki variants have distinct positioning and ad-safe v3 copy', () => {
  const v1 = fs.readFileSync(path.join(publicDir, 'senyouki.html'), 'utf8');
  const v2 = fs.readFileSync(path.join(publicDir, 'senyouki-v2.html'), 'utf8');
  const v3 = fs.readFileSync(path.join(publicDir, 'senyouki-v3.html'), 'utf8');
  assert.match(v1, /反スクール|高額スクール/);
  assert.match(v2, /用途から選ぶから/);
  assert.match(v2, /終わらせたい仕事から選ぶ/);
  assert.match(v3, /やりたい仕事から選べる/);
  assert.match(v3, /収益を保証するサービスではありません/);
  assert.doesNotMatch(v3, /詐欺|騙され|同じ嘘|AI弱者|月[◯0-9]+万/);
});

test('senyouki publication does not replace preregistration integration', () => {
  assert.ok(fs.existsSync(path.join(publicDir, 'preregister.js')));
  assert.ok(fs.existsSync(path.join(publicDir, 'preregister.css')));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /(?:href|src)="preregister\.(?:css|js)"/);
  }
});
