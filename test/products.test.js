const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');
const products = require('../public/products-data');
const page = require('../public/products-page');

test('product data contains only the three live products displayed by the hub', () => {
  assert.deepEqual(page.activeProducts(products).map(({ id }) => id), ['pasyatto', 'quima', 'soramoto']);
  assert.ok(!JSON.stringify(products).includes('未来競馬'));
  for (const product of products) {
    assert.equal(product.status, '販売中');
    assert.match(product.lpUrl, /\/lp\.html$/);
    assert.ok(fs.existsSync(path.join(publicDir, product.logo)), product.logo);
  }
});

test('adding one live data item creates one more card without page changes', () => {
  const dummy = { id: 'dummy', name: 'ダミー', tagline: '説明', audience: '対象', lpUrl: 'https://example.com/lp.html', logo: 'dummy.svg', status: '販売中' };
  const before = page.renderProductCards(products, 'https://swanworks.jp/products');
  const after = page.renderProductCards([...products, dummy], 'https://swanworks.jp/products');
  assert.equal((before.match(/class="product-card"/g) || []).length, 3);
  assert.equal((after.match(/class="product-card"/g) || []).length, 4);
  assert.match(after, /data-product-id="dummy"/);
});

test('product links get defaults and inherit incoming campaign UTM values', () => {
  const product = products[0];
  const defaults = new URL(page.productUrl(product, 'https://swanworks.jp/products'));
  assert.equal(defaults.searchParams.get('utm_source'), 'swanworks');
  assert.equal(defaults.searchParams.get('utm_medium'), 'referral');
  assert.equal(defaults.searchParams.get('utm_campaign'), 'normal-swanworks-hub');
  assert.equal(defaults.searchParams.get('utm_content'), 'pasyatto');

  const inherited = new URL(page.productUrl(product, 'https://swanworks.jp/products?utm_source=x&utm_medium=social&utm_campaign=launch&email=secret%40example.com'));
  assert.equal(inherited.searchParams.get('utm_source'), 'x');
  assert.equal(inherited.searchParams.get('utm_medium'), 'social');
  assert.equal(inherited.searchParams.get('utm_campaign'), 'launch');
  assert.equal(inherited.searchParams.has('email'), false);
});

test('products routes return the same tracked page with complete metadata', async (t) => {
  const previous = process.env.GA4_MEASUREMENT_ID;
  process.env.GA4_MEASUREMENT_ID = 'G-ABC123DEF4';
  const server = require('../src/server').listen(0);
  t.after(() => {
    server.close();
    if (previous === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = previous;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/products', '/products.html']) {
    const response = await fetch(base + route);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-ABC123DEF4/);
    assert.match(html, /<title>製品一覧｜SWAN WORKS<\/title>/);
    for (const metadata of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) assert.match(html, new RegExp(metadata));
  }
});

test('product hub scripts provide GA4 events, accessible states, failure help, and no PII fields', () => {
  const script = fs.readFileSync(path.join(publicDir, 'products-page.js'), 'utf8');
  assert.match(script, /'view_product_list'/);
  assert.match(script, /data-ga4-variant="products-hub"/);
  assert.match(script, /開いています…/);
  assert.match(script, /dataset\.opening === 'true'/);
  assert.match(script, /ポップアップの許可後にリンクをもう一度押す/);
  assert.match(script, /addEventListener\('pageshow'/);
  assert.doesNotMatch(script, /\b(?:email|name|phone|user_id)\s*:/i);
  const html = fs.readFileSync(path.join(publicDir, 'products.html'), 'utf8');
  assert.match(script, /target="_blank" rel="noopener"/);
  assert.match(html, /@media\(max-width:760px\)/);
});

test('CTA shows progress, ignores double clicks, opens safely, and explains popup failure', () => {
  const label = { textContent: '無料で試す' };
  const error = { hidden: true, innerHTML: '' };
  const attributes = new Set();
  const link = {
    href: 'https://example.com/lp.html?utm_source=swanworks',
    dataset: {},
    parentElement: { querySelector: () => error },
    querySelector: () => label,
    setAttribute: (name) => attributes.add(name),
    removeAttribute: (name) => attributes.delete(name)
  };
  const event = { target: { closest: () => link }, preventDefault() {}, stopPropagation() {} };
  const opened = { opener: 'source', location: { href: '' } };
  let openCount = 0;
  const originalOpen = global.open;
  const originalTimeout = global.setTimeout;
  global.open = () => { openCount += 1; return opened; };
  global.setTimeout = () => 1;
  try {
    page.handleProductClick(event);
    assert.equal(label.textContent, '開いています…');
    assert.ok(attributes.has('aria-disabled'));
    assert.equal(opened.opener, null);
    assert.equal(opened.location.href, link.href);
    page.handleProductClick(event);
    assert.equal(openCount, 1);

    link.dataset.opening = '';
    global.open = () => null;
    page.handleProductClick(event);
    assert.equal(error.hidden, false);
    assert.match(error.innerHTML, /ポップアップの許可後にリンクをもう一度押す|こちらのURLを開いてください/);
    assert.equal(label.textContent, '無料で試す');
  } finally {
    global.open = originalOpen;
    global.setTimeout = originalTimeout;
  }
});

test('product list owns tracking through bubbling, double clicks, popup failure, and retries', () => {
  const documentListeners = {};
  const listListeners = {};
  const calls = [];
  const timers = [];
  const label = { textContent: '無料で試す' };
  const error = { hidden: true };
  const link = {
    href: page.productUrl(products[0], 'https://swanworks.jp/products'),
    dataset: { ga4Product: 'pasyatto', ga4Variant: 'products-hub' },
    parentElement: { querySelector: () => error },
    querySelector: () => label,
    setAttribute() {},
    removeAttribute() {}
  };
  const list = {
    addEventListener: (type, listener) => { listListeners[type] = listener; },
    querySelectorAll: () => [link]
  };
  const opened = { location: { href: '' } };
  let popupAllowed = true;
  let openCount = 0;
  const context = vm.createContext({
    URL,
    SWANWORKS_PRODUCTS: products,
    location: { href: 'https://swanworks.jp/products' },
    document: {
      body: { dataset: { ga4Variant: 'products-hub' } },
      querySelector: () => list,
      addEventListener: (type, listener) => { documentListeners[type] = listener; }
    },
    open: () => { openCount += 1; return popupAllowed ? opened : null; },
    setTimeout: (callback) => { timers.push(callback); },
    addEventListener() {},
    gtag: (...args) => {
      if (args[1] === 'select_product') assert.equal(opened.location.href, link.href);
      calls.push(args);
    }
  });
  context.window = context;
  for (const script of ['ga4-events.js', 'products-page.js']) {
    vm.runInContext(fs.readFileSync(path.join(publicDir, script), 'utf8'), context);
  }
  documentListeners.DOMContentLoaded();
  const click = () => {
    const event = {
      target: { closest: () => link },
      stopped: false,
      prevented: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; }
    };
    listListeners.click(event);
    if (!event.stopped) documentListeners.click(event);
    assert.equal(event.prevented, true);
  };
  const selections = () => calls.filter((args) => args[1] === 'select_product');

  click();
  click();
  assert.equal(openCount, 1);
  assert.equal(selections().length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(selections()[0])), ['event', 'select_product', {
    variant: 'products-hub',
    product: 'pasyatto',
    destination_url: link.href,
    transport_type: 'beacon'
  }]);
  timers.shift()();
  popupAllowed = false;
  click();
  assert.equal(selections().length, 1);
  assert.equal(error.hidden, false);
  assert.equal(link.dataset.opening, '');
  popupAllowed = true;
  click();
  assert.equal(selections().length, 2);
  assert.equal(error.hidden, true);
  timers.shift()();
  context.gtag = undefined;
  click();
  assert.equal(openCount, 4);
  assert.equal(opened.location.href, link.href);
  assert.equal(selections().length, 2);
});

test('every corporate page with a global navigation links to the product hub', () => {
  for (const file of ['index.html', 'mission.html', 'philosophy.html', 'senyouki.html', 'senyouki-v2.html', 'senyouki-v3.html', 'products.html']) {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.match(html, /<nav[\s\S]*?href="(?:products\.html|\/products)"[^>]*>製品一覧<\/a>[\s\S]*?<\/nav>/, file);
  }
});
