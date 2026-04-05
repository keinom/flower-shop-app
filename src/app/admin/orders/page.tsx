import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus, OrderType } from "@/types";

interface OrdersPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { status: filterStatus } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(`
      id, status, product_name, quantity, delivery_date, created_at, total_amount,
      customers(id, name)
    `)
    .order("created_at", { ascending: false });

  if (filterStatus) {
    query = query.eq("status", filterStatus);
  }

  const { data: orders, error } = await query;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">注文一覧</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {orders?.length ?? 0} 件
          </span>
          <Link href="/admin/orders/new" className="btn-primary">
            + 注文を作成
          </Link>
        </div>
      </div>

      {/* ステータスフィルター */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filterStatus
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
          }`}
        >
          すべて
        </Link>
        {ORDER_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/orders?status=${encodeURIComponent(status)}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === status
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
            }`}
          >
            {status}
          </Link>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          データの取得に失敗しました
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="th">注文日</th>
              <th className="th">顧客名</th>
              <th className="th">商品名</th>
              <th className="th">合計金額</th>
              <th className="th">お届け希望日</th>
              <th className="th">種別</th>
              <th className="th">ステータス</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!orders || orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="td text-center text-gray-400 py-10">
                  {filterStatus
                    ? `「${filterStatus}」の注文はありません`
                    : "注文データがありません"}
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const customer = order.customers as
                  | { id: string; name: string }
                  | null;
                return (
                  <tr key={order.id} className="tr-hover">
                    <td className="td text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="td">
                      {customer ? (
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {customer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="td font-medium">{order.product_name ?? `${order.quantity}点`}</td>
                    <td className="td text-right">
                      {(order as { total_amount?: number | null }).total_amount != null
                        ? `¥${(order as { total_amount: number }).total_amount.toLocaleString("ja-JP")}`
                        : "—"}
                    </td>
                    <td className="td">
                      {order.delivery_date
                        ? new Date(order.delivery_date).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                    <td className="td">
                      {(order as { order_type?: string }).order_type && (
                        <OrderTypeBadge type={(order as { order_type: string }).order_type as OrderType} size="sm" />
                      )}
                    </td>
                    <td className="td">
                      <StatusBadge status={order.status as OrderStatus} size="sm" />
                    </td>
                    <td className="td">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        詳細・更新
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
