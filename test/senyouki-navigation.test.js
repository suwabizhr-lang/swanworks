const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const publicDir = path.join(__dirname, '..', 'public');
const pages = ['senyouki.html', 'senyouki-v2.html', 'senyouki-v3.html'];
const browser = ['chromium', 'chromium-browser', 'google-chrome'].find((command) => (
  spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000 }).status === 0
));

test('legacy navigation keeps its primary CTA and an adjacent plain product link', () => {
  for (const file of pages) {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    const primary = file === 'senyouki.html'
      ? '<a href="#try" class="cta">無料で試す</a>'
      : '<a class="nav-cta" href="#products">専用機を見る</a>';
    assert.ok(html.includes(`<a href="/products" class="nav-products">製品一覧</a>`), file);
    assert.ok(html.includes(primary), file);
    assert.match(html, /class="nav-actions">\s*<a[^>]*>製品一覧<\/a>\s*<a[^>]*>[^<]+<\/a>\s*<\/div>/, file);
    assert.match(html, /\.nav-products\{[^}]*min-height:44px[^}]*color:inherit[^}]*text-decoration:none/, file);
  }
});

test('legacy navigation fits 375, 390, 768, and 1280px with 44px touch targets', {
  skip: browser ? false : 'Chromium is not installed'
}, (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'swanworks-navigation-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixtures = pages.map((file) => ({
    file,
    html: fs.readFileSync(path.join(publicDir, file), 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<link\b[^>]*>/g, '')
      .replace('<head>', `<head><base href="${pathToFileURL(publicDir + path.sep).href}">`)
  }));
  const fixture = path.join(directory, 'navigation.html');
  fs.writeFileSync(fixture, `<!doctype html><html><body><pre id="results">pending</pre><script>
    const checks = [];
    const ready = [];
    for (const fixture of ${JSON.stringify(fixtures)}) {
      for (const width of [375, 390, 768, 1280]) {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'border:0;height:800px;width:' + width + 'px';
        ready.push(new Promise((resolve) => {
          frame.onload = () => {
            const doc = frame.contentDocument;
            const view = frame.contentWindow;
            const nav = doc.querySelector('nav');
            const product = nav.querySelector('.nav-products');
            const primary = nav.querySelector('.cta, .nav-cta');
            const productStyle = view.getComputedStyle(product);
            const productRect = product.getBoundingClientRect();
            const primaryRect = primary.getBoundingClientRect();
            const navRect = nav.getBoundingClientRect();
            checks.push({
              file: fixture.file, width,
              noOverflow: doc.documentElement.scrollWidth <= doc.documentElement.clientWidth,
              visible: [product, primary].every((link) => {
                const rect = link.getBoundingClientRect();
                const style = view.getComputedStyle(link);
                return rect.height >= 44 && rect.width > 0 && rect.left >= 0 &&
                  rect.right <= doc.documentElement.clientWidth &&
                  rect.top >= navRect.top && rect.bottom <= navRect.bottom &&
                  style.visibility === 'visible' && style.display !== 'none';
              }),
              adjacent: Math.abs(productRect.top - primaryRect.top) < 1 &&
                primaryRect.left - productRect.right >= 0 && primaryRect.left - productRect.right <= 16,
              plain: productStyle.textDecorationLine === 'none' &&
                productStyle.backgroundColor === 'rgba(0, 0, 0, 0)' &&
                productStyle.backgroundImage === 'none' && productStyle.borderTopWidth === '0px' &&
                productStyle.color === view.getComputedStyle(nav).color
            });
            resolve();
          };
        }));
        frame.srcdoc = fixture.html;
        document.body.append(frame);
      }
    }
    Promise.all(ready).then(() => {
      document.getElementById('results').textContent = JSON.stringify(checks);
    });
  </script></body></html>`);
  const result = spawnSync(browser, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', `--user-data-dir=${path.join(directory, 'profile')}`,
    '--dump-dom', '--virtual-time-budget=10000', pathToFileURL(fixture).href
  ], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0 && /Operation not permitted/.test(result.stderr)) {
    t.skip('The sandbox does not permit Chromium to start');
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  const serialized = result.stdout.match(/<pre id="results">([^<]+)<\/pre>/)?.[1];
  assert.ok(serialized && serialized !== 'pending', 'browser measurements completed');
  const checks = JSON.parse(serialized);
  assert.equal(checks.length, 12);
  for (const check of checks) {
    for (const property of ['noOverflow', 'visible', 'adjacent', 'plain']) {
      assert.equal(check[property], true, `${check.file} at ${check.width}px: ${property}`);
    }
  }
});
