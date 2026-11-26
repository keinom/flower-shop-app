-- =============================================================
-- 031: 受信メールの定期自動取り込み（Supabase pg_cron + pg_net）  [Issue #37]
--
-- 10 分ごと（24 時間）に、Vercel の /api/cron/sync-mail を HTTPS GET で呼ぶ。
-- Gmail の鍵は Vercel にのみ存在し、ここ（DB 側）に置く秘密は次の 2 つだけ（Vault に登録）。
--   mail_sync_cron_url     呼び出し先の完全な URL（本番の安定したドメイン）
--   mail_sync_cron_secret  Vercel の CRON_SECRET と同じ値
--
-- ・URL・シークレットの値はこのファイル・ジョブのコマンド文字列・実行履歴に一切現れない
--   （実行のたびに Vault から名前で読む関数を呼ぶだけ）。値の既定値・フォールバックも持たない。
-- ・どちらかが Vault に未登録・空なら HTTP 呼び出しも例外もなく正常終了（no-op）。
--   → 検証／ブランチ DB に適用しても本番エンドポイントは叩かれない。
-- ・何度実行しても同じ結果（拡張は IF NOT EXISTS、ジョブは同名を解除してから再登録）。
-- ・既存テーブルの列・データ・RLS・ポリシーは変更しない。
-- ・拡張は public スキーマに入れない。
-- =============================================================

-- ── 1. 拡張（Supabase の慣例どおりのスキーマ）──────────────
-- pg_cron は自身の cron スキーマを作る（拡張オブジェクトは pg_catalog 側）。pg_net は extensions スキーマ（net スキーマも作られる）。
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ── 2. Vault を読んで定期同期を呼ぶ関数 ────────────────────
-- API（PostgREST）に公開されない private スキーマに置く。anon / authenticated / service_role は実行不可。
-- ジョブは postgres（関数の所有者）として実行される。
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.mail_sync_cron_invoke()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  -- Vault が無い・読めない環境でも例外にしない（未登録と同じ扱いで終了）
  BEGIN
    SELECT s.decrypted_secret INTO v_url
      FROM vault.decrypted_secrets s WHERE s.name = 'mail_sync_cron_url';
    SELECT s.decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets s WHERE s.name = 'mail_sync_cron_secret';
  EXCEPTION WHEN undefined_table OR invalid_schema_name OR insufficient_privilege THEN
    RETURN;
  END;

  v_url    := btrim(coalesce(v_url, ''));
  v_secret := btrim(coalesce(v_secret, ''));

  -- どちらか未登録・空、または https でなければ何もしない
  IF v_url = '' OR v_secret = '' OR v_url !~* '^https://' THEN
    RETURN;
  END IF;

  -- 非同期で HTTP GET を投げる（応答は net._http_response に一定時間残る）。
  -- タイムアウトはエンドポイントの最大所要時間（同期の時間予算 約40秒＋前後処理）より長い 60 秒。
  PERFORM net.http_get(
    url                  := v_url,
    headers              := pg_catalog.jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION private.mail_sync_cron_invoke() FROM PUBLIC, anon, authenticated, service_role;

-- ── 3. ジョブ登録（同名を解除してから再登録 = 重複しない）──────
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job WHERE jobname IN ('mail-sync', 'mail-sync-history-cleanup')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  -- 受信メール同期: 10 分ごと・24 時間。コマンドは関数呼び出しのみ（秘密値を含まない）
  PERFORM cron.schedule('mail-sync', '*/10 * * * *', 'SELECT private.mail_sync_cron_invoke();');

  -- 実行履歴の掃除: 毎日 18:30 UTC（JST 03:30）に 14 日より前の cron.job_run_details を削除。
  -- （自動では消えず、10 分ごとだと年間約 5 万行増えるため）
  PERFORM cron.schedule(
    'mail-sync-history-cleanup',
    '30 18 * * *',
    $cmd$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '14 days';$cmd$
  );
END;
$$;
