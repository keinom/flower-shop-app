-- 発送注文の発送日・発送締め切り時刻を管理するカラムを追加
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_date DATE,
  ADD COLUMN IF NOT EXISTS shipping_deadline TIME;

COMMENT ON COLUMN orders.shipping_date IS '発送日（日報で管理する日付。到着日の前日など）';
COMMENT ON COLUMN orders.shipping_deadline IS '発送締め切り時刻（この時刻までに発送が必要）';
