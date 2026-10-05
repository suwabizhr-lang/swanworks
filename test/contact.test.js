const test = require('node:test');
const assert = require('node:assert/strict');
const { contactEmail, createContactHandler, validateContact } = require('../src/contact');

function responseStub() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('validates and normalizes contact submissions with an optional type', () => {
  assert.deepEqual(validateContact({
    name: '  山田 太郎 ', email: 'USER@example.com ', type: '', message: ' ご相談です ', website: ''
  }), {
    name: '山田 太郎', email: 'user@example.com', type: 'お問い合わせ', message: 'ご相談です', website: ''
  });
  assert.throws(() => validateContact({ name: '山田', email: 'invalid', type: '', message: '', website: '' }));
});

test('creates a contact email with reply-to and submitted fields', () => {
  const message = contactEmail({ name: '山田', email: 'user@example.com', type: 'ご意見', message: '本文' });
  assert.equal(message.subject, '【お問い合わせ】ご意見');
  assert.equal(message.reply_to, 'user@example.com');
  assert.match(message.text, /内容:\n本文/);
});

test('sends valid contact submissions without logging PII', async () => {
  const logs = [];
  const sent = [];
  const handler = createContactHandler({
    services: { send: async (message) => sent.push(message) },
    logger: { info: (...items) => logs.push(items.join(' ')), error: (...items) => logs.push(items.join(' ')) }
  });
  const res = responseStub();
  await handler({ body: { name: '秘密の氏名', email: 'private@example.com', type: '不具合', message: '秘密の本文', website: '' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(sent.length, 1);
  assert.doesNotMatch(logs.join('\n'), /秘密|private@example\.com/);
});

test('accepts honeypot submissions without sending and returns generic failures', async () => {
  let sends = 0;
  const handler = createContactHandler({
    services: { send: async () => { sends += 1; throw new Error('provider detail'); } },
    logger: { info() {}, error() {} }
  });
  const botResponse = responseStub();
  await handler({ body: { website: 'spam', name: 'bot' } }, botResponse);
  assert.equal(botResponse.statusCode, 200);
  assert.equal(sends, 0);

  const failedResponse = responseStub();
  await handler({ body: { name: '山田', email: 'a@example.com', type: '', message: '本文', website: '' } }, failedResponse);
  assert.equal(failedResponse.statusCode, 503);
  assert.doesNotMatch(failedResponse.body.message, /provider detail/);
});
