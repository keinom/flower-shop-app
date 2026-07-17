-- セキュリティ対応（S-1 / S-2）:
-- 1. delivery_destinations マテビューは RLS が効かないため、
--    anon / authenticated からの直接 SELECT を遮断し service_role のみ参照可能にする。
--    アプリ側（delivery-suggestions API）は createAdminClient() 経由で参照を継続する。
-- 2. customer_order_counts ビューが SECURITY DEFINER 相当（postgres 所有）で動作し、
--    一般顧客からも全顧客の注文件数が読めてしまうため、security_invoker 化して
--    参照者本人の権限（orders テーブルの RLS）で評価されるようにする。

REVOKE SELECT ON delivery_destinations FROM anon, authenticated;

ALTER VIEW customer_order_counts SET (security_invoker = true);
