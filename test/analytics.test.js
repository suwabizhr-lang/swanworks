const test = require('node:test');
const assert = require('node:assert/strict');
const { injectGa4, normalizeMeasurementId } = require('../src/analytics');

const html = '<!doctype html><html><head><title>test</title></head><body></body></html>';

test('GA4 is completely disabled when the measurement ID is missing or invalid', () => {
  assert.equal(normalizeMeasurementId(), '');
  assert.equal(normalizeMeasurementId('UA-123456-1'), '');
  assert.equal(injectGa4(html), html);
  assert.equal(injectGa4(html, 'not-a-ga4-id'), html);
  assert.doesNotMatch(injectGa4(html), /googletagmanager|gtag\(/);
});

test('GA4 tag is injected only for a valid environment-style measurement ID', () => {
  const output = injectGa4(html, ' g-abc123def4 ');
  assert.match(output, /googletagmanager\.com\/gtag\/js\?id=G-ABC123DEF4/);
  assert.match(output, /gtag\('config', 'G-ABC123DEF4'\)/);
  assert.equal((output.match(/G-ABC123DEF4/g) || []).length, 2);
});

test('tracked HTTP pages honor the runtime environment fallback', async (t) => {
  const app = require('../src/server');
  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  delete process.env.GA4_MEASUREMENT_ID;
  const disabled = await (await fetch(`${baseUrl}/senyouki`)).text();
  assert.doesNotMatch(disabled, /googletagmanager|gtag\('config'/);

  process.env.GA4_MEASUREMENT_ID = 'G-ABC123DEF4';
  const enabled = await (await fetch(`${baseUrl}/senyouki-v2`)).text();
  assert.match(enabled, /googletagmanager\.com\/gtag\/js\?id=G-ABC123DEF4/);
  const untrackedPage = await (await fetch(`${baseUrl}/mission`)).text();
  assert.doesNotMatch(untrackedPage, /googletagmanager|gtag\('config'/);
  delete process.env.GA4_MEASUREMENT_ID;
});
