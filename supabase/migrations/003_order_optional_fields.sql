-- ============================================================
-- 注文テーブルの項目調整
-- ・delivery_address / delivery_date / product_name を任意項目に変更
-- ・delivery_phone / delivery_email を追加
-- ============================================================

ALTER TABLE orders
  ALTER COLUMN delivery_address DROP NOT NULL,
  ALTER COLUMN delivery_date    DROP NOT NULL,
  ALTER COLUMN product_name     DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_phone text,
  ADD COLUMN IF NOT EXISTS delivery_email text;
