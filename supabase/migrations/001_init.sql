-- ============================================================
-- 花屋注文管理システム 初期マイグレーション
-- Supabase SQL エディタで実行してください
-- ============================================================

-- ============================================================
-- 1. 拡張機能
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- 2. テーブル作成
-- ============================================================

-- プロフィール（auth.users と 1:1 対応）
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'customer')),
  display_name text,
  created_at  timestamptz not null default now()
);

-- 顧客マスタ
create table public.customers (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid references public.profiles(id) on delete set null,
  name        text not null,
  phone       text,
  email       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 注文
create table public.orders (
  id               uuid primary key default uuid_generate_v4(),
  customer_id      uuid not null references public.customers(id) on delete restrict,
  status           text not null default '受付'
                   check (status in ('受付','制作中','配達準備中','配達済み','完了','キャンセル')),
  delivery_name    text not null,
  delivery_address text not null,
  delivery_date    date not null,
  product_name     text not null,
  quantity         integer not null check (quantity > 0),
  purpose          text,
  message_card     text,
  remarks          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 注文ステータス変更履歴
create table public.order_status_logs (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  old_status  text check (old_status in ('受付','制作中','配達準備中','配達済み','完了','キャンセル')),
  new_status  text not null check (new_status in ('受付','制作中','配達準備中','配達済み','完了','キャンセル')),
  changed_by  uuid not null references public.profiles(id) on delete restrict,
  note        text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3. updated_at 自動更新トリガー
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.handle_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 4. 新規ユーザー登録時に profiles を自動作成するトリガー
--    Supabase Auth でユーザーを作成すると自動でprofileが挿入される
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 5. RLS ヘルパー関数
-- ============================================================
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- 現在のユーザーの customer_id を取得
create or replace function public.my_customer_id()
returns uuid as $$
  select id from public.customers
  where profile_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

-- ============================================================
-- 6. Row Level Security 有効化
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.customers         enable row level security;
alter table public.orders            enable row level security;
alter table public.order_status_logs enable row level security;

-- ============================================================
-- 7. RLS ポリシー: profiles
-- ============================================================
-- 自分のプロフィールは読める / adminは全件読める
create policy "profiles_select"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- 自分のプロフィールは更新できる
create policy "profiles_update"
  on public.profiles for update
  using (id = auth.uid());

-- ============================================================
-- 8. RLS ポリシー: customers
-- ============================================================
-- adminは全件読める / 顧客は自分のレコードだけ読める
create policy "customers_select"
  on public.customers for select
  using (public.is_admin() or profile_id = auth.uid());

-- adminのみ登録・更新・削除可能
create policy "customers_insert"
  on public.customers for insert
  with check (public.is_admin());

create policy "customers_update"
  on public.customers for update
  using (public.is_admin());

create policy "customers_delete"
  on public.customers for delete
  using (public.is_admin());

-- ============================================================
-- 9. RLS ポリシー: orders
-- ============================================================
-- adminは全件 / 顧客は自分の注文だけ
create policy "orders_select"
  on public.orders for select
  using (
    public.is_admin()
    or customer_id = public.my_customer_id()
  );

-- 顧客は自分のcustomer_idで注文登録可
create policy "orders_insert"
  on public.orders for insert
  with check (
    public.is_admin()
    or customer_id = public.my_customer_id()
  );

-- ステータス更新はadminのみ
create policy "orders_update"
  on public.orders for update
  using (public.is_admin());

create policy "orders_delete"
  on public.orders for delete
  using (public.is_admin());

-- ============================================================
-- 10. RLS ポリシー: order_status_logs
-- ============================================================
-- adminは全件 / 顧客は自分の注文のログだけ
create policy "order_status_logs_select"
  on public.order_status_logs for select
  using (
    public.is_admin()
    or order_id in (
      select id from public.orders
      where customer_id = public.my_customer_id()
    )
  );

-- 挿入はadminのみ（ステータス更新時のみ記録）
create policy "order_status_logs_insert"
  on public.order_status_logs for insert
  with check (public.is_admin());

-- 履歴の変更・削除は不可（ポリシーなし = 全拒否）

-- ============================================================
-- 11. 初期データについて
-- ============================================================
-- サンプルデータは 002_seed.sql で管理しています。
-- 管理者アカウントは Supabase Auth の UI から作成後、以下を実行してください:
--
-- UPDATE public.profiles
-- SET role = 'admin', display_name = '管理者'
-- WHERE id = '<admin-user-uuid>';
