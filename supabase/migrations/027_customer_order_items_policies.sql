-- ============================================================
-- 027: 顧客が自分の注文明細を編集できるよう order_items に
--      customer 用の INSERT / DELETE ポリシーを追加
--
-- 背景:
--   004_order_items.sql では customer 向けに SELECT ポリシーしか
--   存在せず、015_staff_rls_policies.sql で admin/employee 向けは
--   staff_manage_order_items（FOR ALL）に統合済み。
--   一方 customer は明細の delete/insert が RLS に阻まれて
--   実質失敗するのに、アプリ側は成功表示してしまう不具合があった
--   （customer/orders/[id]/edit/actions.ts）。
--
--   編集可能なステータスは既存の編集画面
--   （customer/orders/[id]/edit/page.tsx, actions.ts）の表示・
--   ガード条件に合わせ「受付」のみとする。
-- ============================================================

-- 顧客は自分の「受付」ステータスの注文にのみ明細を追加できる
create policy "customer_insert_own_order_items"
  on public.order_items for insert
  with check (
    order_id in (
      select id from public.orders
      where customer_id = public.my_customer_id()
        and status = '受付'
    )
  );

-- 顧客は自分の「受付」ステータスの注文の明細のみ削除できる
create policy "customer_delete_own_order_items"
  on public.order_items for delete
  using (
    order_id in (
      select id from public.orders
      where customer_id = public.my_customer_id()
        and status = '受付'
    )
  );
