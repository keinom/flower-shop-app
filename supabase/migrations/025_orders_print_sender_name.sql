-- 印刷用 送り主名:
-- ギフト納品書の「贈り主」欄を顧客マスタの名前から任意の表示名へ
-- 上書きできるようにする任意フィールド。
-- 顧客紐付け (customer_id) や customers.name 自体には影響しない。
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS print_sender_name text;

COMMENT ON COLUMN orders.print_sender_name IS
  'ギフト納品書の贈り主欄を上書きする任意の表示名。NULL なら customers.name を使用。改行を含めて良い。';
