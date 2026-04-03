-- ============================================================
-- 注文明細テーブルの追加 + 合計金額カラムの追加
-- ============================================================

-- order_items テーブル
CREATE TABLE IF NOT EXISTS order_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  integer NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at  timestamptz DEFAULT now()
);

-- orders に合計金額カラムを追加
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount integer;

-- RLS 有効化
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 管理者は全操作可能
CREATE POLICY "admin_manage_order_items"
  ON order_items FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- 顧客は自分の注文の明細のみ閲覧可能
CREATE POLICY "customer_view_own_order_items"
  ON order_items FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = my_customer_id()
    )
  );
