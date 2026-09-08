const path = require('node:path');
const express = require('express');
const { createPreregisterHandler, createServices } = require('./preregister');
const { injectGa4 } = require('./analytics');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, '..', 'public');
const attempts = new Map();
const trackedPages = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/senyouki', 'senyouki.html'],
  ['/senyouki.html', 'senyouki.html'],
  ['/senyouki-v2', 'senyouki-v2.html'],
  ['/senyouki-v2.html', 'senyouki-v2.html'],
  ['/senyouki-v3', 'senyouki-v3.html'],
  ['/senyouki-v3.html', 'senyouki-v3.html']
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

app.use((error, _req, res, _next) => {
  console.error('[server] request_failed', error.message);
  res.status(503).json({ ok: false, message: '現在サービスをご利用いただけません。' });
});

if (require.main === module) {
  app.listen(port, () => console.log(`[server] listening port=${port}`));
}

module.exports = app;
