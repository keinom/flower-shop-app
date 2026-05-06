-- 商品名 (product_name) を任意項目に変更
--
-- 背景:
--   定期注文では事前に商品名を確定できないケースが多く、毎回個別に
--   入力するのが運用負担になっている。商品名は表示用ラベルとして
--   使われるが、データの整合性には必須でない。
--
-- 変更:
--   - order_items.product_name: NOT NULL → NULL 許容
--   - recurring_order_template_items.product_name: NOT NULL → NULL 許容
--   (orders.product_name は既に migration 003 で NULL 許容済み)

ALTER TABLE order_items
  ALTER COLUMN product_name DROP NOT NULL;

ALTER TABLE recurring_order_template_items
  ALTER COLUMN product_name DROP NOT NULL;
