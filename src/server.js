const path = require('node:path');
const express = require('express');
const { createPreregisterHandler, createServices } = require('./preregister');
const { createContactHandler, createContactServices } = require('./contact');
const { injectGa4 } = require('./analytics');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, '..', 'public');
const attempts = new Map();
const contactAttempts = new Map();
const trackedPages = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/senyouki', 'senyouki.html'],
  ['/senyouki.html', 'senyouki.html'],
  ['/senyouki-v2', 'senyouki-v2.html'],
  ['/senyouki-v2.html', 'senyouki-v2.html'],
  ['/senyouki-v3', 'senyouki-v3.html'],
  ['/senyouki-v3.html', 'senyouki-v3.html'],
  ['/lp-affiliate', 'lp-affiliate.html'],
  ['/lp-affiliate.html', 'lp-affiliate.html'],
  ['/affiliate-terms', 'affiliate-terms.html'],
  ['/affiliate-terms.html', 'affiliate-terms.html']
]);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});
app.use(express.json({ limit: '16kb' }));

// Keep inbound links working while each product owns its canonical landing page.
for (const [slug, destination] of [
  ['lp-quima', 'https://quickmarketing-pro.com/lp.html'],
  ['lp-soramoto', 'https://soramoto.jp/lp.html']
]) {
  app.get([`/${slug}`, `/${slug}.html`], (req, res) => {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex);
    res.redirect(301, destination + query);
  });
}

app.get([...trackedPages.keys()], (req, res, next) => {
  const page = trackedPages.get(req.path);
  if (!page) return next();

  try {
    const html = require('node:fs').readFileSync(path.join(publicDir, page), 'utf8');
    res.type('html').send(injectGa4(html, process.env.GA4_MEASUREMENT_ID));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir, { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/preregister', (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return res.status(429).json({ ok: false, message: '少し時間をおいて再度お試しください。' });
  recent.push(now);
  attempts.set(key, recent);
  next();
}, (req, res, next) => {
  try {
    return createPreregisterHandler({ services: createServices() })(req, res);
  } catch (error) {
    next(error);
  }
});

app.post('/api/contact', (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const recent = (contactAttempts.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return res.status(429).json({ ok: false, message: '少し時間をおいて再度お試しください。' });
  recent.push(now);
  contactAttempts.set(key, recent);
  next();
}, (req, res, next) => {
  try {
    return createContactHandler({ services: createContactServices() })(req, res);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('[server] request_failed', error.message);
  res.status(503).json({ ok: false, message: '現在サービスをご利用いただけません。' });
});

if (require.main === module) {
  app.listen(port, () => console.log(`[server] listening port=${port}`));
}

module.exports = app;
