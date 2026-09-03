const test = require('node:test');
const assert = require('node:assert/strict');
const { emailMessage, validatePayload, createPreregisterHandler } = require('../src/preregister');

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
