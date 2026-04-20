-- 顧客テーブルに郵便番号を追加
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS postal_code text;

-- 注文テーブルにお届け先郵便番号を追加
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_postal_code text;
