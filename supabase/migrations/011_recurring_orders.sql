-- 定期注文テンプレート
CREATE TABLE recurring_order_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,

  -- 繰り返し設定
  recurrence_type TEXT NOT NULL
    CHECK (recurrence_type IN ('weekly', 'monthly_date', 'monthly_weekday', 'interval')),
  weekly_days  INTEGER[] DEFAULT NULL,   -- 0=日,1=月,...,6=土
  monthly_day  INTEGER   DEFAULT NULL,   -- 1-31
  monthly_week INTEGER   DEFAULT NULL,   -- 1-4, -1=最終週
  monthly_weekday INTEGER DEFAULT NULL,  -- 0=日...6=土
  interval_days INTEGER  DEFAULT NULL,   -- N日ごと

  -- 期間
  start_date DATE NOT NULL,
  end_date   DATE DEFAULT NULL,

  -- 注文テンプレート情報
  order_type       TEXT NOT NULL DEFAULT '配達'
    CHECK (order_type IN ('来店', '配達', '発送', '生け込み')),
  delivery_name    TEXT NOT NULL,
  delivery_address TEXT DEFAULT NULL,
  delivery_phone   TEXT DEFAULT NULL,
  delivery_email   TEXT DEFAULT NULL,
  delivery_time_start TIME DEFAULT NULL,
  delivery_time_end   TIME DEFAULT NULL,
  purpose      TEXT DEFAULT NULL,
  message_card TEXT DEFAULT NULL,
  remarks      TEXT DEFAULT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE DEFAULT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 定期注文テンプレートの商品明細
CREATE TABLE recurring_order_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES recurring_order_templates(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  description  TEXT DEFAULT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  unit_price   INTEGER NOT NULL DEFAULT 0,
  tax_rate     NUMERIC NOT NULL DEFAULT 10,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- orders に定期注文テンプレートIDを追加
ALTER TABLE orders
  ADD COLUMN recurring_template_id UUID
  REFERENCES recurring_order_templates(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE recurring_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_order_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_recurring_templates" ON recurring_order_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_recurring_template_items" ON recurring_order_template_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
