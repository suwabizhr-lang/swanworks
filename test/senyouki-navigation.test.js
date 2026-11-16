const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const pages = ['senyouki.html', 'senyouki-v2.html', 'senyouki-v3.html'];

function declarations(html, selector) {
  const styles = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`(?:^|[}\\s])${escaped}\\{([^}]+)\\}`));
  assert.ok(rule, `${selector} is styled`);
  return Object.fromEntries(rule[1].split(';').filter(Boolean).map((declaration) => (
    declaration.split(':').map((part) => part.trim())
  )));
}

for (const file of pages) {
  test(`${file}: legacy navigation keeps adjacent actions and wrap-safe touch targets`, () => {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    const nav = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)[0];
    const original = file === 'senyouki.html';
    const primary = original
      ? '<a href="#try" class="cta">無料で試す</a>'
      : '<a class="nav-cta" href="#products">専用機を見る</a>';
    assert.ok(nav.includes(primary));
    assert.match(nav, /class="nav-actions">\s*<a href="\/products" class="nav-products">製品一覧<\/a>\s*<a[^>]*>[^<]+<\/a>\s*<\/div>/);

    const container = declarations(html, original ? 'nav .in' : '.nav-inner');
    assert.equal(container.display, 'flex');
    assert.equal(container['flex-wrap'], 'wrap');
    const actions = declarations(html, original ? 'nav .nav-actions' : '.nav-actions');
    assert.equal(actions.display, 'flex');
    assert.equal(actions['flex-wrap'], 'wrap');
    assert.equal(actions['align-items'], 'center');
    assert.equal(actions['justify-content'], 'flex-end');
    assert.equal(actions['margin-left'], 'auto');
    assert.equal(actions.gap, '12px');

    const product = declarations(html, original ? 'nav .nav-products' : '.nav-products');
    assert.equal(product.color, 'inherit');
    assert.equal(product['text-decoration'], 'none');
    assert.equal(product.padding, '0 4px');
    assert.ok(!Object.keys(product).some((property) => /^(?:background|border)/.test(property)));
    const cta = declarations(html, original ? 'nav a.cta' : '.nav-cta');
    assert.equal(cta['flex-shrink'], '0');
    for (const link of [product, cta]) {
      assert.equal(link.display, 'inline-flex');
      assert.equal(link['align-items'], 'center');
      assert.equal(link['white-space'], 'nowrap');
      assert.match(link['min-height'], /^\d+px$/);
      assert.ok(parseInt(link['min-height'], 10) >= 44);
    }
  });
}
