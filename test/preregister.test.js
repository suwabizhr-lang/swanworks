const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { emailMessage, validatePayload, createPreregisterHandler } = require('../src/preregister');

async function runBrowserSubmission({ ok = true, gtag } = {}) {
  let submit;
  const button = { disabled: false };
  const status = { textContent: '' };
  const fields = { hidden: false };
  const form = {
    classList: { add() {} },
    addEventListener(type, handler) { if (type === 'submit') submit = handler; },
    querySelector(selector) {
      return {
        '[data-preregister-products]': { children: [{ value: true }] },
        '[name="source"]': { value: 'senyouki-v2' },
        '[type="submit"]': button,
        '[data-preregister-status]': status,
        '[data-preregister-fields]': fields
      }[selector];
    }
  };
  const values = {
    name: '秘密の氏名', email: 'private@example.com', products: ['クイマ', 'ソラモト'],
    consent: 'on', source: 'senyouki-v2', website: ''
  };
  const context = {
    window: { gtag },
    document: {
      body: { dataset: { ga4Variant: 'v2' } },
      querySelectorAll(selector) { return selector === '[data-preregister-form]' ? [form] : []; }
    },
    location: { pathname: '/senyouki-v2.html' },
    sessionStorage: { getItem() { return 'submission-id'; }, setItem() {} },
    crypto: { randomUUID() { return 'generated-id'; } },
    FormData: class {
      get(name) { return values[name]; }
      getAll(name) { return values[name]; }
    },
    fetch: async () => ({ ok, json: async () => ok ? {} : { message: 'failed' } })
  };
  const script = fs.readFileSync(path.join(__dirname, '../public/preregister.js'), 'utf8');
  vm.runInNewContext(script, context);
  await submit({ preventDefault() {} });
}

test('validates and normalizes a valid submission', () => {
  const result = validatePayload({
    name: '  すわ  ', email: 'USER@example.com',
    products: ['クイマ', 'ソラモト', 'クイマ'], consent: true, source: 'lp-quima'
  });
  assert.deepEqual(result, { name: 'すわ', email: 'user@example.com', products: ['クイマ', 'ソラモト'], source: 'lp-quima' });
});

test('rejects unknown products and missing consent', () => {
  assert.throws(() => validatePayload({ name: 'A', email: 'a@example.com', products: ['unknown'], consent: true, source: 'index' }));
  assert.throws(() => validatePayload({ name: 'A', email: 'a@example.com', products: ['クイマ'], consent: false, source: 'index' }));
});

test('accepts the newly announced products', () => {
  const products = ['ソバイル（Sobail）', 'エマイア（EMAIA）', 'AI営業提案システム（仮称：提案すごい君）'];
  const result = validatePayload({ name: 'A', email: 'a@example.com', products, consent: true, source: 'index' });
  assert.deepEqual(result.products, products);
});

test('creates the required subject and body', () => {
  const message = emailMessage({ id: 'abc', name: 'すわ', email: 'a@example.com', products: ['クイマ', 'ソラモト'], source: 'lp-quima', submittedAt: '2026-09-03T00:00:00.000Z' });
  assert.equal(message.subject, '【先行案内】クイマ, ソラモト');
  assert.match(message.text, /氏名: すわ/);
  assert.match(message.text, /送信元ページ: lp-quima/);
});

test('persists before sending and suppresses completed duplicates', async () => {
  const calls = [];
  const services = {
    find: async () => null,
    save: async () => calls.push('save'),
    send: async (message) => { calls.push(message.subject); return { id: 'mail-1' }; },
    markEmail: async (_id, status) => calls.push(`mark:${status}`)
  };
  const handler = createPreregisterHandler({ services, logger: { info() {}, error() {} } });
  const req = { body: { name: 'すわ', email: 'a@example.com', products: ['クイマ', 'ソラモト'], consent: true, source: 'lp-quima', submissionId: '12345678-abcd-4abc-8abc-1234567890ab' } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls, ['save', '【先行案内】クイマ, ソラモト', 'mark:sent']);
});

test('sends a PII-free GA4 lead event after a successful submission', async () => {
  const calls = [];
  await runBrowserSubmission({ gtag: (...args) => calls.push(args) });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    'event', 'generate_lead',
    { variant: 'v2', source: 'senyouki-v2', products: 'クイマ,ソラモト' }
  ]]);
  assert.equal('name' in calls[0][2], false);
  assert.equal('email' in calls[0][2], false);
});

test('does not send a GA4 lead event for a failed submission', async () => {
  const calls = [];
  await runBrowserSubmission({ ok: false, gtag: (...args) => calls.push(args) });
  assert.deepEqual(calls, []);
});

test('allows a successful submission when GA4 is unavailable', async () => {
  await assert.doesNotReject(runBrowserSubmission());
});
