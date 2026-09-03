const path = require('node:path');
const express = require('express');
const { createPreregisterHandler, createServices } = require('./preregister');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, '..', 'public');
const attempts = new Map();

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

app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error('[server] request_failed', error.message);
  res.status(503).json({ ok: false, message: '現在サービスをご利用いただけません。' });
});

if (require.main === module) {
  app.listen(port, () => console.log(`[server] listening port=${port}`));
}

module.exports = app;
