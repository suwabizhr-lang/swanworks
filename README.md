# SWAN WORKS corporate site

Node.js + Expressで `public/` の静的サイトを配信し、`POST /api/preregister` で先行案内を受け付けます。

## セットアップ

1. `npm install`
2. `.env.example` を参考に環境変数を設定
3. Supabase SQL Editorで `supabase/migrations/001_create_preregistrations.sql` を実行
4. `npm start`

## フォーム組み込み

各HTMLに `/preregister.css` と `/preregister.js` を読み込み、`public/index.html` の `data-preregister-form` を持つフォームを複製します。各ページでは hidden の `source` を `mission`、`lp-pasha` などに設定します。

## 本番環境変数

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（ブラウザに公開しない）
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_TO`
- `NODE_ENV`
- `NODE_VERSION`
