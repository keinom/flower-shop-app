import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/types";

interface CustomerTopPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function CustomerTopPage({ searchParams }: CustomerTopPageProps) {
  const { status: filterStatus } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 自分の顧客レコードを取得
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("profile_id", user.id)
    .single();

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-500 text-sm">
          アカウントに顧客情報が紐づいていません。
          <br />
          管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  // 自分の注文を取得
  let query = supabase
    .from("orders")
    .select("id, status, product_name, quantity, delivery_date, created_at, purpose, total_amount")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (filterStatus) {
    query = query.eq("status", filterStatus as OrderStatus);
  }

  const { data: orders } = await query;

  // ステータス別件数（フィルター用）
  const { data: allOrders } = await supabase
    .from("orders")
    .select("status")
    .eq("customer_id", customer.id);

  const statusCounts = ORDER_STATUSES.reduce((acc, s) => {
    acc[s] = allOrders?.filter((o) => o.status === s).length ?? 0;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const activeCount = allOrders?.filter((o) =>
    ["受付", "受付完了", "作成中", "ラッピング中", "配達準備完了", "配達中"].includes(o.status)
  ).length ?? 0;

  return (
    <div className="space-y-5">
      {/* ようこそメッセージ + 新規注文ボタン */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">注文履歴</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customer.name} 様</p>
        </div>
        <Link href="/customer/orders/new" className="btn-primary">
          + 新しい注文をする
        </Link>
      </div>

      {/* 対応中バナー */}
      {activeCount > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-brand-600 text-lg">🌿</span>
          <p className="text-sm text-brand-800">
            現在 <strong>{activeCount}件</strong> のご注文を対応中です
          </p>
        </div>
      )}

      {/* ステータスフィルター */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/customer"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filterStatus
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
          }`}
        >
          すべて（{allOrders?.length ?? 0}）
        </Link>
        {ORDER_STATUSES.filter((s) => statusCounts[s] > 0).map((status) => (
          <Link
            key={status}
            href={`/customer?status=${encodeURIComponent(status)}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === status
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
            }`}
          >
            {status}（{statusCounts[status]}）
          </Link>
        ))}
      </div>

      {/* 注文一覧 */}
      {!orders || orders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🌸</p>
          <p className="text-gray-600 font-medium">
            {filterStatus ? `「${filterStatus}」の注文はありません` : "まだご注文がありません"}
          </p>
          {!filterStatus && (
            <Link href="/customer/orders/new" className="btn-primary mt-4 inline-flex">
              最初の注文をする
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/customer/orders/${order.id}`}
              className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow block"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={order.status as OrderStatus} size="sm" />
                  {order.purpose && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {order.purpose}
                    </span>
                  )}
                </div>
                <p className="font-medium text-gray-900 truncate">
                  {order.product_name ?? `${order.quantity}点`}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {(order as { total_amount?: number | null }).total_amount != null && (
                    <span className="font-medium text-brand-700 mr-2">
                      ¥{(order as { total_amount: number }).total_amount.toLocaleString("ja-JP")}
                    </span>
                  )}
                  {order.delivery_date
                    ? `お届け希望日: ${new Date(order.delivery_date).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}`
                    : "お届け日未定"}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <p className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </p>
                <span className="text-gray-400 text-sm">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
