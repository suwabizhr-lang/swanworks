const { z } = require('zod');

const CONTACT_TYPES = Object.freeze(['お問い合わせ', 'ご意見', '不具合', 'その他']);

const contactSchema = z.object({
  name: z.string().trim().min(1, 'お名前を入力してください。').max(100),
  email: z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください。').max(254),
  type: z.enum(CONTACT_TYPES).optional().or(z.literal('')).transform((value) => value || 'お問い合わせ'),
  message: z.string().trim().min(1, '内容を入力してください。').max(5000),
  website: z.string().max(0).optional()
}).strict();

function validateContact(body = {}) {
  return contactSchema.parse(body);
}

function contactEmail(input) {
  return {
    subject: `【お問い合わせ】${input.type}`,
    reply_to: input.email,
    text: [
      'SWAN WORKS お問い合わせフォームから新しい送信がありました。',
      '',
      `お名前: ${input.name}`,
      `メール: ${input.email}`,
      `種別: ${input.type}`,
      '',
      '内容:',
      input.message
    ].join('\n')
  };
}

function createContactServices({ env = process.env, fetchImpl = fetch } = {}) {
  for (const name of ['RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO']) {
    if (!env[name]) throw new Error(`Missing environment variable: ${name}`);
  }
  return {
    async send(message) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [env.MAIL_TO], ...message })
      });
      if (!response.ok) throw new Error(`Resend delivery failed (${response.status})`);
      return response.json();
    }
  };
}

function createContactHandler({ services, logger = console } = {}) {
  return async function contact(req, res) {
    if (typeof req.body?.website === 'string' && req.body.website) {
      return res.status(200).json({ ok: true, message: 'お問い合わせを受け付けました。' });
    }
    try {
      const input = validateContact(req.body);
      await services.send(contactEmail(input));
      logger.info('[contact] mail_sends=1');
      return res.status(201).json({ ok: true, message: 'お問い合わせを受け付けました。' });
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 503;
      logger.error(`[contact] failed status=${status} mail_sends=0`);
      return res.status(status).json({
        ok: false,
        message: status === 400 ? '入力内容をご確認ください。' : '現在送信できません。時間をおいて再度お試しください。'
      });
    }
  };
}

module.exports = { CONTACT_TYPES, contactEmail, createContactHandler, createContactServices, validateContact };
