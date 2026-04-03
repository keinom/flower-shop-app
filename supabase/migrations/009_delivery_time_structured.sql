-- delivery_time テキスト列を削除し、開始・終了時刻に変更
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_time;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time_start time;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time_end   time;
