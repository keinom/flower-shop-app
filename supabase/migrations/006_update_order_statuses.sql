-- ============================================================
-- 注文ステータスの変更
--   制作中  → 受付完了
--   配達済み → 配達完了
--   完了    → 配達完了
-- ============================================================

-- orders テーブルの既存データを移行
UPDATE orders SET status = '受付完了' WHERE status = '制作中';
UPDATE orders SET status = '配達完了' WHERE status = '配達済み';
UPDATE orders SET status = '配達完了' WHERE status = '完了';

-- order_status_logs の履歴データも移行（表示の一貫性のため）
UPDATE order_status_logs SET old_status = '受付完了' WHERE old_status = '制作中';
UPDATE order_status_logs SET old_status = '配達完了' WHERE old_status = '配達済み';
UPDATE order_status_logs SET old_status = '配達完了' WHERE old_status = '完了';
UPDATE order_status_logs SET new_status = '受付完了' WHERE new_status = '制作中';
UPDATE order_status_logs SET new_status = '配達完了' WHERE new_status = '配達済み';
UPDATE order_status_logs SET new_status = '配達完了' WHERE new_status = '完了';
