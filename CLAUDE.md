# 花長注文管理システム

花屋の法人・継続顧客向け注文管理システム。Next.js + Supabase で構築。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS v4
- **バックエンド**: Supabase (PostgreSQL + Auth + Storage)
- **デプロイ**: Vercel

## ディレクトリ構成

```
src/
  app/
    admin/        # 管理者向けページ（注文・顧客・請求・シフト・立て札・設定）
    customer/     # 顧客向けページ（注文・日次注文）
    api/          # Route Handlers（cron 2本・顧客・請求・受信メール同期/添付/未対応件数）
    login/        # 認証ページ
    page.tsx      # ルートリダイレクト（ログイン状態・ロールで振り分け）
  components/
    admin/        # 管理者向けコンポーネント
    customer/     # 顧客向けコンポーネント
    ui/           # 共通UIコンポーネント
  lib/
    supabase/     # Supabaseクライアント（server.ts / client.ts）
    gmail/        # Gmail連携（server-only: 認証・API・MIME解析・同期・フィクスチャ）
    auth/         # staff権限チェック共通ヘルパ（requireStaff 系）
    constants.ts  # 定数
    recurring.ts  # 定期注文ロジック
    shipping.ts   # 配送ロジック
  types/
    database.ts   # Supabase自動生成型
    index.ts      # アプリ共通型
supabase/
  migrations/     # DBマイグレーション（001〜031）
```

## 主な機能

- **ロールベースアクセス**: `admin` / `customer` の2ロール（`profiles.role`で管理）
- **注文管理**: 単発・定期注文、配送時間、注文ステータス管理
- **請求管理**: 月次請求書の生成・管理
- **シフト管理**: スタッフシフトの登録・管理
- **立て札管理**: PDF OCR（Gemini API）で立て札情報を抽出
- **顧客管理**: 法人・継続顧客の情報管理
- **受信メール**: 代表アドレス宛メールを Gmail API で取り込み（読み取り専用）、対応ステータス・担当者・メモ管理、送信者→顧客の自動照合（`/admin/mail`）
  - 定期同期: Supabase 側（pg_cron + pg_net、10分ごと）が `GET /api/cron/sync-mail` を呼ぶ（マイグレーション 031。URL とシークレットは Supabase Vault に登録。未登録の間は何もしない）。管理画面のナビバッジは開きっぱなしでも件数だけ自動更新（`/api/mail/unhandled-count`）

## 環境変数

`.env.local` に以下を設定（`.env.local.example` 参照）:

```
NEXT_PUBLIC_SUPABASE_URL=       # SupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon公開キー
SUPABASE_SERVICE_ROLE_KEY=      # サービスロールキー（サーバーサイドのみ）
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 受信メール（Gmail連携）。すべて server-only。設定手順は docs/GMAIL_SETUP.md
GMAIL_SA_CLIENT_EMAIL=          # サービスアカウントのメールアドレス
GMAIL_SA_PRIVATE_KEY=           # サービスアカウントの秘密鍵（改行は \n 表記可）
GMAIL_IMPERSONATE_USER=         # 読み取り対象の代表アドレス（環境変数で固定）
GMAIL_INITIAL_SYNC_DAYS=        # 任意（既定30）
GMAIL_FIXTURE_MODE=             # 開発・検証専用（1で架空データ。本番では無視）
```

## 開発コマンド

```bash
npm run dev    # 開発サーバー起動（http://localhost:3000）
npm run build  # プロダクションビルド
npm run lint   # ESLint実行
```

## ブランチ運用

- 開発ブランチ: `claude/test-github-connection-bVT62`
- mainブランチへのマージはPR経由

## cron エンドポイント（`CRON_SECRET` の Bearer 認可。未設定時は常に401）

- `/api/cron/generate-recurring-orders`: 定期注文の生成。Vercel Cron（`vercel.json`、毎日 15:00 UTC）から起動
- `/api/cron/sync-mail`: 受信メールの定期同期。**Vercel Cron ではなく Supabase の pg_cron（10分ごと）から起動**される。`vercel.json` には書かない
- `CRON_SECRET` は Vercel と Supabase Vault の2か所に同じ値を置く（ローテーション時は両方更新）

## DBマイグレーション

`supabase/migrations/` に順番に適用。Supabase CLI または ダッシュボードから実行。

## 注意事項

- `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみ使用。クライアントコードに含めないこと
- Supabase Auth のセッション管理は `@supabase/ssr` を使用
- `src/types/database.ts` は Supabase CLI (`supabase gen types`) で自動生成
