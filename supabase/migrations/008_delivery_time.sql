-- お届け希望時間帯カラムを追加
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time text;
