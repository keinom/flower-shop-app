import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OrderStatus } from "@/types";
import { ORDER_STATUSES } from "@/lib/constants";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // 注文件数をステータス別に集計
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, created_at, delivery_date, product_name, customers(name)")
    .order("created_at", { ascending: false });

  const statusCounts = ORDER_STATUSES.reduce(
    (acc, status) => {
      acc[status] = orders?.filter((o) => o.status === status).length ?? 0;
      return acc;
    },
    {} as Record<OrderStatus, number>
  );

  // 直近10件
  const recentOrders = orders?.slice(0, 10) ?? [];

  // 顧客数
  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true });

  const totalOrders = orders?.length ?? 0;
  const activeOrders =
    orders?.filter((o) =>
      ["受付", "制作中", "配達準備中"].includes(o.status)
    ).length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="顧客数" value={customerCount ?? 0} unit="社/名" href="/admin/customers" />
        <SummaryCard label="総注文数" value={totalOrders} unit="件" href="/admin/orders" />
        <SummaryCard label="対応中の注文" value={activeOrders} unit="件" href="/admin/orders?status=受付" accent />
      </div>

      {/* ステータス別件数 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">注文ステータス別件数</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ORDER_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/orders?status=${encodeURIComponent(status)}`}
              className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <StatusBadge status={status} size="sm" />
              <span className="text-2xl font-bold text-gray-800 mt-2">
                {statusCounts[status]}
              </span>
              <span className="text-xs text-gray-500">件</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 直近の注文 */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">直近の注文</h2>
          <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">
            すべて見る →
          </Link>
        </div>
        <div className="table-container rounded-none rounded-b-lg border-0">
          <table className="table">
            <thead>
              <tr>
                <th className="th">顧客名</th>
                <th className="th">商品名</th>
                <th className="th">お届け希望日</th>
                <th className="th">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td text-center text-gray-400 py-8">
                    注文データがありません
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="tr-hover">
                    <td className="td">
                      {(order.customers as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="td">{order.product_name}</td>
                    <td className="td">
                      {new Date(order.delivery_date).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="td">
                      <Link href={`/admin/orders/${order.id}`}>
                        <StatusBadge status={order.status as OrderStatus} size="sm" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  href,
  accent = false,
}: {
  label: string;
  value: number;
  unit: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className={`card p-5 hover:shadow-md transition-shadow ${
          accent ? "border-brand-300 bg-brand-50" : ""
        }`}
      >
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1">
          <span
            className={`text-3xl font-bold ${accent ? "text-brand-700" : "text-gray-900"}`}
          >
            {value}
          </span>
          <span className="text-sm text-gray-500 ml-1">{unit}</span>
        </p>
      </div>
    </Link>
  );
}
