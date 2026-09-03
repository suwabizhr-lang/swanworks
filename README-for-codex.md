# SWAN WORKS サイト一式（Codex 引き渡し用）

このzip（`swanworks-site.zip`）は、SWAN WORKS コーポレートサイトの静的ファイル一式です。
リポジトリ `suwabizhr-lang/swanworks`（Render デプロイ）の `public/` にそのまま配置してください。

## 中身
```
public/
  index.html            … TOP（ヒーロー・4つの体験・プロダクト・サブスク訴求）
  mission.html          … ミッション
  philosophy.html       … 私たちの考え
  lp-pasha.html         … パシャっと出品 LP（CTAは既存 https://video-analyzer-5d8w.onrender.com へ）
  lp-quima.html         … クイマ LP（料金5プラン・動画=プレミアム誘導）
  lp-soramoto.html      … ソラモト LP
  lp-mirai-keiba.html   … 未来競馬 LP
  logo/                 … SWAN WORKS ロゴ画像（round/square/text/wide 01・wide 02）
  assets/               … クイマ/ソラモトの画像（quima-*, soramoto-hero.png）
```

## ページ内リンク（相対）
- ナビ「プロダクト」プルダウン → 各 lp-*.html、パシャは外部 Render URL。
- ミッション/私たちの考え → mission.html / philosophy.html。
- お問い合わせ → `mailto:swanworks.jp@gmail.com`。

## 実装してほしいこと（別途 Issue/プロンプト参照）
- Express で `public/` を静的配信、`/` は index.html。
- 全ページ共通「先行案内フォーム」＋ `POST /api/preregister`（swanworks.jp@gmail.com へ通知・件名ルール `【先行案内】<プロダクト>`・送信データ保存）。
- Render デプロイ、カスタムドメイン swanworks.jp 接続用の DNS 手順を報告。

## 注意
- ロゴ・画像パスは各HTML内で `logo/...` `assets/...`（相対）を参照。`public/` 直下に置けばそのまま動く。
- 文字コードは UTF-8。日本語を含む。
