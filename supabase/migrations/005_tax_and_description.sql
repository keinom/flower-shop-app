-- ============================================================
-- 税率設定テーブルの追加 + order_itemsへの税率・説明カラム追加
-- ============================================================

-- 税率設定テーブル（変更履歴も保持）
CREATE TABLE IF NOT EXISTS tax_settings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rate        integer NOT NULL DEFAULT 10 CHECK (rate >= 0 AND rate <= 100),
  note        text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

-- デフォルト税率（10%）を挿入
INSERT INTO tax_settings (rate, note)
VALUES (10, '初期設定（消費税10%）');

-- order_items に税率カラムを追加（注文時点の税率を記録）
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_rate integer NOT NULL DEFAULT 10;

-- order_items に商品説明カラムを追加
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS description text;

-- RLS 有効化
ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;

-- 管理者のみ全操作可能
CREATE POLICY "admin_manage_tax_settings"
  ON tax_settings FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- 認証済みユーザーは税率を参照可能（注文作成時に必要）
CREATE POLICY "authenticated_read_tax_settings"
  ON tax_settings FOR SELECT TO authenticated
  USING (true);
