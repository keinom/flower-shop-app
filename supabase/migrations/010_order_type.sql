-- 注文種別カラムを追加
ALTER TABLE orders
  ADD COLUMN order_type TEXT NOT NULL DEFAULT '配達'
  CHECK (order_type IN ('来店', '配達', '発送', '生け込み'));
