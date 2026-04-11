-- ============================================================
-- 013_invoices.sql
-- 請求書テーブル追加
-- ============================================================

-- ── 請求書 ──────────────────────────────────────────────────
create table if not exists public.invoices (
  id                uuid        primary key default uuid_generate_v4(),
  invoice_number    text        not null unique,
  customer_id       uuid        not null references public.customers(id) on delete restrict,
  invoice_type      text        not null check (invoice_type in ('single', 'monthly')),
  target_year_month text,                          -- 月別の場合 'YYYY-MM'
  status            text        not null default 'draft'
                    check (status in ('draft', 'issued', 'sent', 'paid')),
  subtotal          integer     not null default 0,
  tax_amount        integer     not null default 0,
  total_amount      integer     not null default 0,
  issued_at         timestamptz,
  sent_at           timestamptz,
  due_date          date,
  remarks           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── 請求書明細 ────────────────────────────────────────────────
create table if not exists public.invoice_items (
  id          uuid        primary key default uuid_generate_v4(),
  invoice_id  uuid        not null references public.invoices(id) on delete cascade,
  order_id    uuid        references public.orders(id) on delete set null,
  description text        not null,
  quantity    integer     not null default 1,
  unit_price  integer     not null default 0,
  tax_rate    numeric     not null default 10,
  created_at  timestamptz not null default now()
);

-- ── インデックス ───────────────────────────────────────────────
create index if not exists invoices_customer_id_idx    on public.invoices(customer_id);
create index if not exists invoices_status_idx         on public.invoices(status);
create index if not exists invoices_created_at_idx     on public.invoices(created_at desc);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items(invoice_id);
create index if not exists invoice_items_order_id_idx  on public.invoice_items(order_id);

-- ── updated_at トリガー ────────────────────────────────────────
create or replace trigger invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;

-- 既存ポリシーを削除してから再作成（冪等）
drop policy if exists "invoices_select"       on public.invoices;
drop policy if exists "invoices_insert"       on public.invoices;
drop policy if exists "invoices_update"       on public.invoices;
drop policy if exists "invoices_delete"       on public.invoices;
drop policy if exists "invoice_items_select"  on public.invoice_items;
drop policy if exists "invoice_items_insert"  on public.invoice_items;
drop policy if exists "invoice_items_update"  on public.invoice_items;
drop policy if exists "invoice_items_delete"  on public.invoice_items;

-- invoices: admin のみ全操作可
create policy "invoices_select"
  on public.invoices for select
  using (public.is_admin());

create policy "invoices_insert"
  on public.invoices for insert
  with check (public.is_admin());

create policy "invoices_update"
  on public.invoices for update
  using (public.is_admin());

create policy "invoices_delete"
  on public.invoices for delete
  using (public.is_admin());

-- invoice_items: admin のみ全操作可
create policy "invoice_items_select"
  on public.invoice_items for select
  using (public.is_admin());

create policy "invoice_items_insert"
  on public.invoice_items for insert
  with check (public.is_admin());

create policy "invoice_items_update"
  on public.invoice_items for update
  using (public.is_admin());

create policy "invoice_items_delete"
  on public.invoice_items for delete
  using (public.is_admin());
