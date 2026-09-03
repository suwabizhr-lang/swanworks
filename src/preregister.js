const crypto = require('node:crypto');

const PRODUCT_LABELS = Object.freeze([
  'パシャっと出品',
  'クイマ',
  'ソラモト',
  '未来競馬',
  '株スク',
  'VoiceKey',
  'MIMAMORO'
]);

class PublicError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validatePayload(body = {}) {
  const name = cleanText(body.name, 100);
  const email = cleanText(body.email, 254).toLowerCase();
  const source = cleanText(body.source, 80) || 'unknown';
  const products = Array.isArray(body.products)
    ? [...new Set(body.products.filter((item) => PRODUCT_LABELS.includes(item)))]
    : [];

  if (!name) throw new PublicError(400, '氏名を入力してください。');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PublicError(400, '正しいメールアドレスを入力してください。');
  }
  if (!products.length) throw new PublicError(400, '興味のあるプロダクトを選択してください。');
  if (body.consent !== true) throw new PublicError(400, 'ご案内の受信に同意してください。');
  if (!/^[a-zA-Z0-9/_-]+$/.test(source)) throw new PublicError(400, '送信元ページが不正です。');

  return { name, email, products, source };
}

function emailMessage(submission) {
  const productList = submission.products.join(', ');
  return {
    subject: `【先行案内】${productList}`,
    text: [
      'SWAN WORKS 先行案内フォームに新しい登録がありました。',
      '',
      `氏名: ${submission.name}`,
      `メール: ${submission.email}`,
      `選択プロダクト: ${productList}`,
      `送信元ページ: ${submission.source}`,
      `送信日時: ${submission.submittedAt}`,
      `受付ID: ${submission.id}`
    ].join('\n')
  };
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

function createServices({ env = process.env, fetchImpl = fetch } = {}) {
  requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO']);
  const tableUrl = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/preregistrations`;
  const supabaseHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  return {
    async find(id) {
      const response = await fetchImpl(`${tableUrl}?id=eq.${encodeURIComponent(id)}&select=id,email_status`, {
        headers: supabaseHeaders
      });
      if (!response.ok) throw new Error(`Supabase lookup failed (${response.status})`);
      const rows = await response.json();
      return rows[0] || null;
    },
    async save(submission) {
      const response = await fetchImpl(tableUrl, {
        method: 'POST',
        headers: { ...supabaseHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: submission.id,
          name: submission.name,
          email: submission.email,
          products: submission.products,
          source: submission.source,
          consent: true,
          submitted_at: submission.submittedAt,
          email_status: 'pending'
        })
      });
      if (!response.ok && response.status !== 409) throw new Error(`Supabase insert failed (${response.status})`);
      return response.status !== 409;
    },
    async markEmail(id, status, providerId = null) {
      const response = await fetchImpl(`${tableUrl}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ email_status: status, email_provider_id: providerId })
      });
      if (!response.ok) throw new Error(`Supabase update failed (${response.status})`);
    },
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

function createPreregisterHandler({ services, logger = console } = {}) {
  return async function preregister(req, res) {
    try {
      if (req.body?.website) return res.status(200).json({ ok: true });
      const input = validatePayload(req.body);
      const id = cleanText(req.body.submissionId, 80) || crypto.randomUUID();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new PublicError(400, '受付IDが不正です。');
      }

      const existing = await services.find(id);
      if (existing?.email_status === 'sent') {
        return res.status(200).json({ ok: true, duplicate: true });
      }

      const submission = { ...input, id, submittedAt: new Date().toISOString() };
      if (!existing) {
        await services.save(submission);
        logger.info('[preregister] db_writes=1 mail_sends=0');
      }

      try {
        const delivery = await services.send(emailMessage(submission));
        await services.markEmail(id, 'sent', delivery.id || null);
        logger.info('[preregister] db_writes=1 mail_sends=1');
      } catch (error) {
        await services.markEmail(id, 'failed').catch(() => {});
        throw error;
      }

      return res.status(201).json({ ok: true, message: 'ありがとうございます。準備が整い次第ご案内します' });
    } catch (error) {
      const status = error instanceof PublicError ? error.status : 503;
      logger.error(`[preregister] failed status=${status} db_writes=0 mail_sends=0`, error.message);
      return res.status(status).json({
        ok: false,
        message: status < 500 ? error.message : '現在送信できません。時間をおいて再度お試しください。'
      });
    }
  };
}

module.exports = { PRODUCT_LABELS, PublicError, createPreregisterHandler, createServices, emailMessage, validatePayload };
