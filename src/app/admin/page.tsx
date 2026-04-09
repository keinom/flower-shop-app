import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import { DashboardDateNav } from "@/components/admin/DashboardDateNav";
import type { OrderStatus, OrderType } from "@/types";
import { ORDER_STATUSES } from "@/lib/constants";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

// YYYY-MM-DD を加減算
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function tokyoToday(): string {
  return new Date()
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "-");
}

export default async function AdminDashboard({ searchParams }: Props) {
  const sp = await searchParams;
  const today = tokyoToday();
  const selectedDate = sp.date ?? today;

  const supabase = await createClient();

  // ── 選択日のお届け予定注文 ──
  const { data: dayOrders } = await supabase
    .from("orders")
    .select(`
      id, status, order_type, created_at,
      product_name, quantity, delivery_date, delivery_name,
      purpose, total_amount,
      customers(id, name)
    `)
    .eq("delivery_date", selectedDate)
    .order("created_at", { ascending: true });

  const orders = dayOrders ?? [];

  // ステータス別集計（件数が0でも全ステータス表示）
  const statusCounts = ORDER_STATUSES.reduce(
    (acc, s) => { acc[s] = orders.filter((o) => o.status === s).length; return acc; },
    {} as Record<OrderStatus, number>
  );

  // 顧客数・全体件数（ヘッダー用）
  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true });

  const { count: totalOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });

  return (
    <div className="space-y-6">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
        {/* 顧客数・総注文数サマリー */}
        <div className="flex gap-3">
          <Link href="/admin/customers" className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors">
            <span className="block text-gray-400 mb-0.5">顧客数</span>
            <span className="font-bold text-gray-800 text-base">{customerCount ?? 0}</span>
            <span className="ml-1 text-gray-500">社/名</span>
          </Link>
          <Link href="/admin/orders" className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors">
            <span className="block text-gray-400 mb-0.5">総注文数</span>
            <span className="font-bold text-gray-800 text-base">{totalOrderCount ?? 0}</span>
            <span className="ml-1 text-gray-500">件</span>
          </Link>
        </div>
      </div>

      {/* ─── 日付ナビゲーション ─── */}
      <div className="card p-4">
        <DashboardDateNav
          currentDate={selectedDate}
          prevDate={addDays(selectedDate, -1)}
          nextDate={addDays(selectedDate, 1)}
          todayDate={today}
        />
      </div>

      {/* ─── 選択日のサマリー ─── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            この日のお届け予定
          </h2>
          <span className="text-2xl font-bold text-brand-700">
            {orders.length}
            <span className="text-sm font-normal text-gray-500 ml-1">件</span>
          </span>
        </div>

        {/* ステータス別件数（全ステータス） */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ORDER_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/orders?status=${encodeURIComponent(status)}&delivery_from=${selectedDate}&delivery_to=${selectedDate}`}
              className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
                statusCounts[status] > 0
                  ? "bg-white border-gray-200 hover:bg-brand-50 hover:border-brand-200"
                  : "bg-gray-50 border-transparent opacity-50"
              }`}
            >
              <StatusBadge status={status} size="sm" />
              <span className={`text-xl font-bold mt-1.5 ${statusCounts[status] > 0 ? "text-gray-800" : "text-gray-400"}`}>
                {statusCounts[status]}
              </span>
              <span className="text-xs text-gray-400">件</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── 当日の注文一覧（時系列） ─── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">注文一覧（注文日時順）</h2>
          <Link
            href={`/admin/orders?delivery_from=${selectedDate}&delivery_to=${selectedDate}`}
            className="text-xs text-brand-600 hover:underline"
          >
            注文検索で開く →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400 space-y-1">
            <span className="text-3xl">📭</span>
            <p className="text-sm">この日のお届け予定はありません</p>
          </div>
        ) : (
          <div className="table-container rounded-none rounded-b-lg border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th"></th>
                  <th className="th">注文日時</th>
                  <th className="th">顧客名</th>
                  <th className="th">商品名</th>
                  <th className="th">お届け先</th>
                  <th className="th">用途</th>
                  <th className="th">種別</th>
                  <th className="th text-right">金額</th>
                  <th className="th">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const customer = order.customers as { id: string; name: string } | null;
                  return (
                    <tr key={order.id} className="tr-hover">
                      <td className="td">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-sm text-brand-600 hover:underline whitespace-nowrap font-medium"
                        >
                          詳細
                        </Link>
                      </td>
                      <td className="td text-xs text-gray-500 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleString("ja-JP", {
                          month: "numeric", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="td text-sm">
                        {customer ? (
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="text-brand-700 hover:underline"
                          >
                            {customer.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="td text-sm font-medium">
                        {order.product_name ?? `${order.quantity}点`}
                      </td>
                      <td className="td text-sm text-gray-600">
                        {(order as { delivery_name?: string }).delivery_name ?? "—"}
                      </td>
                      <td className="td text-sm text-gray-500">
                        {(order as { purpose?: string }).purpose ?? "—"}
                      </td>
                      <td className="td">
                        {(order as { order_type?: string }).order_type && (
                          <OrderTypeBadge
                            type={(order as { order_type: string }).order_type as OrderType}
                            size="sm"
                          />
                        )}
                      </td>
                      <td className="td text-right text-sm whitespace-nowrap">
                        {(order as { total_amount?: number | null }).total_amount != null
                          ? `¥${(order as { total_amount: number }).total_amount.toLocaleString("ja-JP")}`
                          : "—"}
                      </td>
                      <td className="td">
                        <StatusBadge status={order.status as OrderStatus} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
