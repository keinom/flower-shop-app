-- 顧客ごとの注文件数を集計するビュー
-- （PostgREST の max-rows=1000 制限を回避し、顧客一覧に正しい件数を表示するため）

CREATE OR REPLACE VIEW customer_order_counts AS
SELECT
  customer_id,
  COUNT(*)::int AS order_count
FROM orders
WHERE customer_id IS NOT NULL
GROUP BY customer_id;
