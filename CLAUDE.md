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
    api/          # Route Handlers（cron・顧客・請求）
    login/        # 認証ページ
    page.tsx      # ルートリダイレクト（ログイン状態・ロールで振り分け）
  components/
    admin/        # 管理者向けコンポーネント
    customer/     # 顧客向けコンポーネント
    ui/           # 共通UIコンポーネント
  lib/
    supabase/     # Supabaseクライアント（server.ts / client.ts）
    constants.ts  # 定数
    recurring.ts  # 定期注文ロジック
    shipping.ts   # 配送ロジック
  types/
    database.ts   # Supabase自動生成型
    index.ts      # アプリ共通型
supabase/
  migrations/     # DBマイグレーション（001〜018）
```

## 主な機能

- **ロールベースアクセス**: `admin` / `customer` の2ロール（`profiles.role`で管理）
- **注文管理**: 単発・定期注文、配送時間、注文ステータス管理
- **請求管理**: 月次請求書の生成・管理
- **シフト管理**: スタッフシフトの登録・管理
- **立て札管理**: PDF OCR（Gemini API）で立て札情報を抽出
- **顧客管理**: 法人・継続顧客の情報管理

## 環境変数

`.env.local` に以下を設定（`.env.local.example` 参照）:

```
NEXT_PUBLIC_SUPABASE_URL=       # SupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon公開キー
SUPABASE_SERVICE_ROLE_KEY=      # サービスロールキー（サーバーサイドのみ）
NEXT_PUBLIC_SITE_URL=http://localhost:3000
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

## DBマイグレーション

`supabase/migrations/` に順番に適用。Supabase CLI または ダッシュボードから実行。

## 注意事項

- `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみ使用。クライアントコードに含めないこと
- Supabase Auth のセッション管理は `@supabase/ssr` を使用
- `src/types/database.ts` は Supabase CLI (`supabase gen types`) で自動生成
