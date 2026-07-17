-- ============================================================
-- 028: パフォーマンス改善 第1弾 - DBインデックス追加
-- ============================================================
-- 背景:
--   orders テーブルは数万行規模あるのに主キー以外の実用インデックスが
--   ほぼ無く（trgm 2本のみ）、customer_id 絞り込みが Seq Scan で
--   約1.6秒かかることを EXPLAIN ANALYZE で確認。
--   ほぼ全画面が orders / order_items を参照するため、これが遅さの主犯。
--   あわせて Supabase Performance Advisor（get_advisors type=performance）
--   が指摘する未インデックス外部キー11件も解消する。
--
-- 影響: インデックス追加のみ。スキーマ・データ変更なし。書き込み時に
--       短時間ロックが発生し得るため、本番適用は営業時間外を推奨。
-- ============================================================

-- ── orders: 検索・ダッシュボードで頻用する列 ──
CREATE INDEX IF NOT EXISTS orders_customer_id_idx          ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_delivery_date_idx        ON public.orders (delivery_date);
CREATE INDEX IF NOT EXISTS orders_shipping_date_idx         ON public.orders (shipping_date);
CREATE INDEX IF NOT EXISTS orders_created_at_idx            ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_recurring_template_id_idx ON public.orders (recurring_template_id);

-- ダッシュボード（src/app/admin/page.tsx）の「対応中の注文」クエリに合わせた
-- 部分インデックス: 完了・キャンセル・履歴を除いたアクティブ注文を created_at 降順で取得
CREATE INDEX IF NOT EXISTS orders_active_created_at_idx
  ON public.orders (created_at DESC)
  WHERE status NOT IN ('完了', 'キャンセル', '履歴');

-- ダッシュボードの「代未」クエリに合わせた部分インデックス
-- （payment_status は本番DBに存在する列。マイグレーション未管理のまま追加された
--   ため 003〜027 のどのファイルにも定義がないが、admin/page.tsx が直接参照している
--   ため実運用DBには存在する前提。列が無い環境では本マイグレーションはエラーになる）
CREATE INDEX IF NOT EXISTS orders_unpaid_delivery_date_idx
  ON public.orders (delivery_date)
  WHERE payment_status = '代未' AND status NOT IN ('キャンセル', '履歴');

-- ── order_items ──
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

-- ── order_status_logs ──
CREATE INDEX IF NOT EXISTS order_status_logs_order_id_idx   ON public.order_status_logs (order_id);
CREATE INDEX IF NOT EXISTS order_status_logs_changed_by_idx ON public.order_status_logs (changed_by);

-- ── customers ──
CREATE INDEX IF NOT EXISTS customers_profile_id_idx ON public.customers (profile_id);

-- ── recurring_order_templates / recurring_order_template_items ──
CREATE INDEX IF NOT EXISTS recurring_order_templates_customer_id_idx
  ON public.recurring_order_templates (customer_id);
CREATE INDEX IF NOT EXISTS recurring_order_template_items_template_id_idx
  ON public.recurring_order_template_items (template_id);

-- ── fuda_documents / shift_requirements / tax_settings ──
CREATE INDEX IF NOT EXISTS fuda_documents_created_by_idx  ON public.fuda_documents (created_by);
CREATE INDEX IF NOT EXISTS shift_requirements_updated_by_idx ON public.shift_requirements (updated_by);
CREATE INDEX IF NOT EXISTS tax_settings_created_by_idx     ON public.tax_settings (created_by);
