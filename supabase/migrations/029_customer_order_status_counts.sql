-- ============================================================
-- 029: 顧客トップ（注文履歴）のステータス別件数を DB 側で集計する RPC
-- ============================================================
-- 背景:
--   src/app/customer/page.tsx は従来、ステータス別件数を出すためだけに
--   自分の注文を全件（status列のみとはいえ）取得して JS 側で filter/reduce
--   していた。件数が多い顧客ほど無駄な転送・計算が発生するため、
--   DB 側の GROUP BY 集計に置き換える。
--
-- セキュリティ:
--   026_secure_views.sql と同様の考え方で、この関数は SECURITY DEFINER に
--   せず（デフォルトの SECURITY INVOKER のまま）呼び出し元の権限で実行する。
--   本文の WHERE 句で customer_id = my_customer_id() に絞り込んだ上、
--   orders テーブル自体の RLS（orders_select: is_admin() OR
--   customer_id = my_customer_id()）も呼び出し元の権限でそのまま適用される
--   ため、二重に自分の注文以外が混ざらないことを担保する。
-- ============================================================

CREATE OR REPLACE FUNCTION public.customer_order_status_counts()
RETURNS TABLE (status text, order_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT status, COUNT(*)::bigint AS order_count
  FROM public.orders
  WHERE customer_id = public.my_customer_id()
  GROUP BY status;
$$;
