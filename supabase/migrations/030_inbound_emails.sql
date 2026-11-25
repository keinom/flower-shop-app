-- ============================================================
-- 030: 受信メール機能 第1弾（Gmail 取り込み・対応ステータス管理・顧客照合）
-- ============================================================
-- 追加するもの:
--   1. inbound_emails        … 取り込んだ受信メール（本文は保持、添付の実体は保存しない）
--   2. email_sync_state      … Gmail 同期状態（historyId・最終同期・エラー概要・同時実行ロック）
--   3. customers の lower(btrim(email)) 式インデックス（送信者アドレス照合用）
--   4. match_customers_by_email() … 送信者アドレス → 顧客の照合 RPC（security invoker）
--
-- 方針:
--   - 両テーブルとも RLS 有効・staff（admin / employee）限定。anon / customer は不可。
--   - ポリシーは (select public.is_staff()) 形式（auth_rls_initplan 回避）。
--   - DELETE ポリシーは作らない（画面からの削除機能なし）。
--   - 取り込み（INSERT）と同期状態の更新は Server 側のサービスロールのみが行う。
--     staff に開く更新はステータス・担当者・メモ・紐付け顧客の4列だけ（列権限で制限）。
--   - 何度実行しても壊れないよう IF NOT EXISTS / DROP POLICY IF EXISTS を使用。
--
-- 影響: 既存テーブルの列・データ・RLS は変更しない。customers へのインデックス追加のみ
--       短時間ロックが発生し得るため、本番適用は営業時間外を推奨。
-- ============================================================

-- ── 1. inbound_emails ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Gmail 識別子（重複取り込み防止の衝突キー / スレッド参照）
  gmail_message_id   text        NOT NULL UNIQUE,
  gmail_thread_id    text        NOT NULL,

  -- RFC822 ヘッダ（第2弾の返信でスレッドを正しく繋ぐために保存）
  message_id_header  text,
  references_header  text,
  reply_to           text,

  -- 送信者（from_address は小文字化・trim 済み。顧客照合用）
  from_name          text,
  from_address       text        NOT NULL DEFAULT '',
  to_addresses       text,
  cc_addresses       text,

  subject            text        NOT NULL DEFAULT '',
  snippet            text,
  body_text          text,
  body_html          text,

  -- Gmail の internalDate 基準
  received_at        timestamptz NOT NULL,

  -- 添付メタデータ（実体は保存しない）:
  --   [{ "filename": text, "mime_type": text, "size": int, "part_id": text }]
  attachments        jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- 基幹システム側だけの対応状況（Gmail の既読/ラベルとは連動しない）
  status             text        NOT NULL DEFAULT '未対応'
                     CHECK (status IN ('未対応', '対応中', '対応済み')),
  assigned_to        uuid        REFERENCES public.profiles(id)  ON DELETE SET NULL,
  memo               text,
  status_updated_by  uuid        REFERENCES public.profiles(id)  ON DELETE SET NULL,
  status_updated_at  timestamptz,

  -- 送信者アドレスから一意に特定できた顧客（複数一致・不一致は NULL）
  customer_id        uuid        REFERENCES public.customers(id) ON DELETE SET NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 一覧: 受信日時の降順
CREATE INDEX IF NOT EXISTS inbound_emails_received_at_idx
  ON public.inbound_emails (received_at DESC);

-- 未対応の絞り込み + ナビバッジの count(*)（全ページのレイアウト描画に乗るため部分インデックス）
CREATE INDEX IF NOT EXISTS inbound_emails_unhandled_idx
  ON public.inbound_emails (received_at DESC)
  WHERE status = '未対応';

-- スレッド参照 / 送信者検索 / 外部キー
CREATE INDEX IF NOT EXISTS inbound_emails_thread_id_idx    ON public.inbound_emails (gmail_thread_id);
CREATE INDEX IF NOT EXISTS inbound_emails_from_address_idx ON public.inbound_emails (from_address);
CREATE INDEX IF NOT EXISTS inbound_emails_assigned_to_idx  ON public.inbound_emails (assigned_to);
CREATE INDEX IF NOT EXISTS inbound_emails_customer_id_idx  ON public.inbound_emails (customer_id);
CREATE INDEX IF NOT EXISTS inbound_emails_status_updated_by_idx
  ON public.inbound_emails (status_updated_by);

-- ステータス変更時に「誰がいつ変えたか」を DB 側で確実に記録する（クライアント値を信用しない）
CREATE OR REPLACE FUNCTION public.inbound_emails_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_by := auth.uid();
    NEW.status_updated_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inbound_emails_set_audit ON public.inbound_emails;
CREATE TRIGGER inbound_emails_set_audit
  BEFORE UPDATE ON public.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION public.inbound_emails_set_audit();

-- RLS: staff 限定（SELECT / UPDATE のみ。INSERT はサービスロール、DELETE は無し）
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbound_emails_select" ON public.inbound_emails;
CREATE POLICY "inbound_emails_select"
  ON public.inbound_emails FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "inbound_emails_update" ON public.inbound_emails;
CREATE POLICY "inbound_emails_update"
  ON public.inbound_emails FOR UPDATE
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

-- ── 2. email_sync_state ────────────────────────────────────
-- メールボックスごとに 1 行（現状は代表アドレス 1 つなので 'primary' のみ）。
-- メールアドレスそのものは保存しない（impersonate 先は環境変数で固定）。
CREATE TABLE IF NOT EXISTS public.email_sync_state (
  mailbox_key      text        PRIMARY KEY,
  last_history_id  text,
  last_synced_at   timestamptz,           -- 最終「成功」同期日時
  last_error       text,                  -- エラー概要のみ（鍵・トークン・本文は入れない）
  last_error_at    timestamptz,
  lock_token       uuid,
  locked_at        timestamptz,
  lock_expires_at  timestamptz,           -- 異常終了でもこの時刻を過ぎれば再取得可能
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_sync_state (mailbox_key)
VALUES ('primary')
ON CONFLICT (mailbox_key) DO NOTHING;

ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_sync_state_select" ON public.email_sync_state;
CREATE POLICY "email_sync_state_select"
  ON public.email_sync_state FOR SELECT
  USING ((SELECT public.is_staff()));

-- ── 権限（両テーブル）──
-- まず anon / authenticated の権限を全て剥がす（TRUNCATE / REFERENCES / TRIGGER、既定の全体 SELECT や
-- 列権限も含む）。そのうえで必要なものだけ付与し直す。service_role（サーバー側の同期処理）には触れない。
REVOKE ALL ON public.inbound_emails, public.email_sync_state FROM anon, authenticated;

-- inbound_emails: staff は SELECT と、対応管理に必要な4列の UPDATE のみ
--   （本文・送信者・受信日時・Gmail 識別子などは API 経由でも書き換えられない。INSERT/DELETE も不可）
GRANT SELECT ON public.inbound_emails TO authenticated;
GRANT UPDATE (status, assigned_to, memo, customer_id) ON public.inbound_emails TO authenticated;

-- email_sync_state: 書き込みはサービスロール（RLS をバイパス）のみ。
--   staff が読める列は lock_token / locked_at / last_history_id を除いたものだけ。
GRANT SELECT (mailbox_key, last_synced_at, last_error, last_error_at, lock_expires_at)
  ON public.email_sync_state TO authenticated;

-- ── 3. customers: 送信者アドレス照合用の式インデックス ──────
-- 照合式は lower(btrim(email))。クエリと式を一致させないとインデックスが使われないため
-- lower(email) 単体ではなく btrim を含めた式で作成する。
CREATE INDEX IF NOT EXISTS customers_lower_email_idx
  ON public.customers (lower(btrim(email)))
  WHERE email IS NOT NULL;

-- ── 4. 送信者アドレス → 顧客の照合 RPC ─────────────────────
-- 026_secure_views.sql / 029 と同じ方針: security invoker（呼び出し元の権限＋RLS で実行）、
-- anon / PUBLIC には実行権限を付けない。
CREATE OR REPLACE FUNCTION public.match_customers_by_email(p_emails text[])
RETURNS TABLE (email_key text, customer_id uuid, customer_name text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT lower(btrim(c.email)) AS email_key, c.id AS customer_id, c.name AS customer_name
  FROM public.customers c
  WHERE c.email IS NOT NULL
    AND lower(btrim(c.email)) = ANY (p_emails)
  ORDER BY c.created_at, c.id;
$$;

REVOKE ALL ON FUNCTION public.match_customers_by_email(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_customers_by_email(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_customers_by_email(text[]) TO authenticated, service_role;
