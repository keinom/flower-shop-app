-- ============================================================
-- ステータス「配達準備中」→「配達準備完了」に変更
-- ============================================================

-- CHECK制約を削除
ALTER TABLE orders            DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE order_status_logs DROP CONSTRAINT IF EXISTS order_status_logs_old_status_check;
ALTER TABLE order_status_logs DROP CONSTRAINT IF EXISTS order_status_logs_new_status_check;

-- データ移行
UPDATE orders            SET status     = '配達準備完了' WHERE status     = '配達準備中';
UPDATE order_status_logs SET old_status = '配達準備完了' WHERE old_status = '配達準備中';
UPDATE order_status_logs SET new_status = '配達準備完了' WHERE new_status = '配達準備中';

-- 新しいCHECK制約を追加
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    '受付', '受付完了', '作成中', 'ラッピング中',
    '配達準備完了', '配達中', '配達完了', 'キャンセル'
  ));

ALTER TABLE order_status_logs ADD CONSTRAINT order_status_logs_old_status_check
  CHECK (old_status IN (
    '受付', '受付完了', '作成中', 'ラッピング中',
    '配達準備完了', '配達中', '配達完了', 'キャンセル'
  ));

ALTER TABLE order_status_logs ADD CONSTRAINT order_status_logs_new_status_check
  CHECK (new_status IN (
    '受付', '受付完了', '作成中', 'ラッピング中',
    '配達準備完了', '配達中', '配達完了', 'キャンセル'
  ));
