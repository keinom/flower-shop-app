-- 印刷用お届け先名: 納品書印刷時に通常の delivery_name とは異なる宛名を
-- 出したいケースに対応するため、任意の上書きフィールドを追加。
-- 顧客紐付け (customer_id) や検索用 delivery_name には影響しない。
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS print_delivery_name text;

COMMENT ON COLUMN orders.print_delivery_name IS
  '納品書印刷時の宛名上書き。NULL ならば delivery_name を使用。改行を含めて良い。';
