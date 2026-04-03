-- ============================================================
-- 注文ステータスの変更
--   制作中  → 受付完了
--   配達済み → 配達完了
--   完了    → 配達完了
-- ============================================================

-- ① CHECK制約を一旦削除
ALTER TABLE orders           DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE order_status_logs DROP CONSTRAINT IF EXISTS order_status_logs_old_status_check;
ALTER TABLE order_status_logs DROP CONSTRAINT IF EXISTS order_status_logs_new_status_check;

-- ② データ移行
UPDATE orders SET status = '受付完了' WHERE status = '制作中';
UPDATE orders SET status = '配達完了' WHERE status = '配達済み';
UPDATE orders SET status = '配達完了' WHERE status = '完了';

UPDATE order_status_logs SET old_status = '受付完了' WHERE old_status = '制作中';
UPDATE order_status_logs SET old_status = '配達完了' WHERE old_status = '配達済み';
UPDATE order_status_logs SET old_status = '配達完了' WHERE old_status = '完了';
UPDATE order_status_logs SET new_status = '受付完了' WHERE new_status = '制作中';
UPDATE order_status_logs SET new_status = '配達完了' WHERE new_status = '配達済み';
UPDATE order_status_logs SET new_status = '配達完了' WHERE new_status = '完了';

-- ③ 新しいステータス値でCHECK制約を再追加
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    '受付', '受付完了', '作成中', 'ラッピング中',
    '配達準備中', '配達中', '配達完了', 'キャンセル'
  ));

ALTER TABLE order_status_logs ADD CONSTRAINT order_status_logs_old_status_check
  CHECK (old_status IN (
    '受付', '受付完了', '作成中', 'ラッピング中',
    '配達準備中', '配達中', '配達完了', 'キャンセル'
  ));

ALTER TABLE order_status_logs ADD CONSTRAINT order_status_logs_new_status_check
  CHECK (new_status IN (
    '受付', '受付完了', '作成中', 'ラッピング中',
    '配達準備中', '配達中', '配達完了', 'キャンセル'
  ));
