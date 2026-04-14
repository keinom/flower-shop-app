-- ============================================================
-- 015: RLS ポリシーを employee ロールにも対応させる
--
-- is_admin() → is_staff() に切り替えることで
-- admin・employee の両方が業務データを操作できるようにする。
-- tax_settings（消費税率設定）は引き続き admin のみ。
-- ============================================================

-- is_staff() 関数: admin または employee なら true（未作成の場合に備えて）
create or replace function public.is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'employee')
  );
$$ language sql security definer stable;

-- ============================================================
-- profiles
-- ============================================================
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

-- ============================================================
-- customers
-- ============================================================
drop policy if exists "customers_select" on public.customers;
drop policy if exists "customers_insert" on public.customers;
drop policy if exists "customers_update" on public.customers;
drop policy if exists "customers_delete" on public.customers;

create policy "customers_select"
  on public.customers for select
  using (public.is_staff() or profile_id = auth.uid());

create policy "customers_insert"
  on public.customers for insert
  with check (public.is_staff());

create policy "customers_update"
  on public.customers for update
  using (public.is_staff());

create policy "customers_delete"
  on public.customers for delete
  using (public.is_staff());

-- ============================================================
-- orders
-- ============================================================
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "orders_delete" on public.orders;

create policy "orders_select"
  on public.orders for select
  using (
    public.is_staff()
    or customer_id = public.my_customer_id()
  );

create policy "orders_insert"
  on public.orders for insert
  with check (
    public.is_staff()
    or customer_id = public.my_customer_id()
  );

create policy "orders_update"
  on public.orders for update
  using (public.is_staff());

create policy "orders_delete"
  on public.orders for delete
  using (public.is_staff());

-- ============================================================
-- order_status_logs
-- ============================================================
drop policy if exists "order_status_logs_select" on public.order_status_logs;
drop policy if exists "order_status_logs_insert" on public.order_status_logs;

create policy "order_status_logs_select"
  on public.order_status_logs for select
  using (
    public.is_staff()
    or order_id in (
      select id from public.orders
      where customer_id = public.my_customer_id()
    )
  );

create policy "order_status_logs_insert"
  on public.order_status_logs for insert
  with check (public.is_staff());

-- ============================================================
-- order_items
-- ============================================================
drop policy if exists "admin_manage_order_items" on public.order_items;

create policy "staff_manage_order_items"
  on public.order_items for all
  using (public.is_staff()) with check (public.is_staff());

-- customer_view_own_order_items はそのまま残す

-- ============================================================
-- recurring_order_templates
-- ============================================================
drop policy if exists "admin_all_recurring_templates" on public.recurring_order_templates;

create policy "staff_all_recurring_templates"
  on public.recurring_order_templates for all
  using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- recurring_order_template_items
-- ============================================================
drop policy if exists "admin_all_recurring_template_items" on public.recurring_order_template_items;

create policy "staff_all_recurring_template_items"
  on public.recurring_order_template_items for all
  using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- invoices / invoice_items
-- ============================================================
drop policy if exists "invoices_select"      on public.invoices;
drop policy if exists "invoices_insert"      on public.invoices;
drop policy if exists "invoices_update"      on public.invoices;
drop policy if exists "invoices_delete"      on public.invoices;
drop policy if exists "invoice_items_select" on public.invoice_items;
drop policy if exists "invoice_items_insert" on public.invoice_items;
drop policy if exists "invoice_items_update" on public.invoice_items;
drop policy if exists "invoice_items_delete" on public.invoice_items;

create policy "invoices_select"
  on public.invoices for select
  using (public.is_staff());

create policy "invoices_insert"
  on public.invoices for insert
  with check (public.is_staff());

create policy "invoices_update"
  on public.invoices for update
  using (public.is_staff());

create policy "invoices_delete"
  on public.invoices for delete
  using (public.is_staff());

create policy "invoice_items_select"
  on public.invoice_items for select
  using (public.is_staff());

create policy "invoice_items_insert"
  on public.invoice_items for insert
  with check (public.is_staff());

create policy "invoice_items_update"
  on public.invoice_items for update
  using (public.is_staff());

create policy "invoice_items_delete"
  on public.invoice_items for delete
  using (public.is_staff());

-- ============================================================
-- tax_settings は admin のみのまま維持（変更なし）
-- ============================================================
