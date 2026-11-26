-- ============================================================
-- 032: 作成系フォームの二重送信対策（冪等キー）
-- ============================================================
-- 背景（Issue #40）:
--   登録ボタンの連打・通信の再送などで同じ内容の顧客／注文が二重に作成されていた。
--   ブラウザ側のボタン無効化に加え、サーバー側でも「同じ送信は 1 回しか処理しない」ようにする。
--
-- 方式:
--   作成対象テーブルに idempotency_key（フォーム表示時にブラウザ側で発行した UUID）を持たせ、
--   NULL でない行に限った一意インデックスで二重 INSERT を DB 側で弾く。
--   一意制約違反（SQLSTATE 23505）になったら、アプリ側が同じキーの既存行を引いて
--   その詳細画面へ遷移する（src/lib/idempotency.ts）。
--
-- 影響:
--   - 追加のみ。既存行の idempotency_key は NULL のまま（部分インデックスの対象外）。
--     既存データに重複があっても本マイグレーションは失敗しない。
--   - 列は NULL 許容・デフォルト値なし → ADD COLUMN はメタデータ変更のみ（テーブル書き換えなし）。
--   - 一意インデックスの作成は対象テーブルの書き込みを短時間ブロックする（SHARE ロック）。
--     部分インデックスのため格納される行は 0 件で、実質は全行スキャンのみ。
--     orders 約 6.8 万行でも通常 1 秒未満。CONCURRENTLY は使わない
--     （マイグレーションはトランザクション内で実行されるため CONCURRENTLY は使えない）。
--   - 万一ロック待ちで詰まらないよう lock_timeout を設定（失敗した場合は再実行可能）。
--   - RLS ポリシー・列権限は変更しない（既存の insert ポリシーは行単位のため、
--     顧客ロールの注文作成でも idempotency_key を書き込める）。
--   - 何度実行しても安全（IF NOT EXISTS）。
-- ============================================================

set local lock_timeout = '10s';

alter table public.customers                add column if not exists idempotency_key uuid;
alter table public.orders                   add column if not exists idempotency_key uuid;
alter table public.recurring_order_templates add column if not exists idempotency_key uuid;
alter table public.invoices                 add column if not exists idempotency_key uuid;

create unique index if not exists customers_idempotency_key_uidx
  on public.customers (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists recurring_order_templates_idempotency_key_uidx
  on public.recurring_order_templates (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists invoices_idempotency_key_uidx
  on public.invoices (idempotency_key)
  where idempotency_key is not null;
