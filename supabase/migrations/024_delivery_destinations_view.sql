-- お届け先の高速検索のための準備
--
-- 1. pg_trgm 拡張を有効化
-- 2. customers / orders に trigram GIN インデックス
-- 3. 過去のユニークなお届け先を集約した materialized view を作成
--    - 同名（空白・大小無視で正規化）の直近の住所等を採用
--    - 文字化けタグ付きレコードは除外
-- 4. CONCURRENTLY リフレッシュ用の関数
--
-- 通常 view では 66K件の集約コストが大きく 400ms 超だったため、
-- materialized view + trigram index 構成を採用。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_name_trgm
  ON orders USING gin (delivery_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_address_trgm
  ON orders USING gin (delivery_address gin_trgm_ops);

CREATE MATERIALIZED VIEW IF NOT EXISTS delivery_destinations AS
WITH normalized AS (
  SELECT
    LOWER(regexp_replace(delivery_name, '[[:space:]]+', '', 'g')) AS key,
    delivery_name,
    delivery_postal_code,
    delivery_address,
    delivery_phone,
    delivery_email,
    delivery_date,
    created_at
  FROM orders
  WHERE delivery_name IS NOT NULL
    AND delivery_name <> ''
    AND (remarks IS NULL OR remarks NOT LIKE '%【delivery_name文字化け・要確認】%')
),
ranked AS (
  SELECT
    key,
    delivery_name,
    delivery_postal_code,
    delivery_address,
    delivery_phone,
    delivery_email,
    delivery_date,
    COUNT(*) OVER (PARTITION BY key) AS use_count,
    ROW_NUMBER() OVER (
      PARTITION BY key
      ORDER BY delivery_date DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM normalized
)
SELECT
  key,
  delivery_name        AS display_name,
  delivery_postal_code AS postal_code,
  delivery_address     AS address,
  delivery_phone       AS phone,
  delivery_email       AS email,
  use_count,
  delivery_date        AS last_used
FROM ranked
WHERE rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_destinations_key
  ON delivery_destinations (key);

CREATE INDEX IF NOT EXISTS idx_delivery_destinations_name_trgm
  ON delivery_destinations USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_delivery_destinations_address_trgm
  ON delivery_destinations USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_delivery_destinations_phone
  ON delivery_destinations (phone);

CREATE INDEX IF NOT EXISTS idx_delivery_destinations_use_count
  ON delivery_destinations (use_count DESC);

CREATE OR REPLACE FUNCTION refresh_delivery_destinations()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY delivery_destinations;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW delivery_destinations IS
  'お届け先のユニーク集約。同名で複数住所がある場合は直近の注文の値を採用。';
