-- ============================================================
-- 014: 従業員ロールの追加
-- profiles.role の CHECK 制約に 'employee' を追加する
-- ============================================================

-- 既存の CHECK 制約を削除して再定義
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'employee', 'customer'));

-- is_staff() 関数: admin または employee なら true
create or replace function public.is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'employee')
  );
$$ language sql security definer stable;
