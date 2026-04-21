-- 注文ステータスの「配達完了」を「完了」にリネーム
-- （配達・来店・発送など全注文種別で使う汎用ステータスのため、より簡潔な名称に統一）

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders SET status = '完了' WHERE status = '配達完了';

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    '受付'::text,
    '受付完了'::text,
    '作成中'::text,
    'ラッピング中'::text,
    '配達準備完了'::text,
    '配達中'::text,
    '完了'::text,
    'キャンセル'::text,
    '履歴'::text
  ]));
