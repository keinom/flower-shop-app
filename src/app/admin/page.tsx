import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import type { OrderStatus, OrderType } from "@/types";
import { ORDER_STATUSES } from "@/lib/constants";
import { formatJstDate, formatJstTime, jstDateString, todayJst } from "@/lib/date";

// 完了・キャンセル・履歴を除いたアクティブステータス
// （履歴は移行した過去データ用ステータスなのでダッシュボードには出さない）
const ACTIVE_STATUSES = ORDER_STATUSES.filter(
  (s) => s !== "完了" && s !== "キャンセル" && s !== "履歴"
);

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = todayJst();

  // アクティブな全注文（完了・キャンセル除外）
  const { data: activeOrders } = await supabase
    .from("orders")
    .select(
      `id, status, order_type, created_at,
       product_name, quantity, delivery_date, delivery_name,
       purpose, total_amount, customers(id, name)`
    )
    .not("status", "eq", "完了")
    .not("status", "eq", "キャンセル")
    .not("status", "eq", "履歴")
    .order("created_at", { ascending: false });

  const orders = activeOrders ?? [];

  // 今日の新着注文（本日 created_at）
  const todayOrders = orders.filter((o) => jstDateString(o.created_at) === today);

  // 受付中（要対応）
  const pendingOrders = orders.filter((o) => o.status === "受付");

  // 代未注文（全ステータス対象）
  const { data: unpaidData } = await supabase
    .from("orders")
    .select(`id, status, order_type, created_at,
             product_name, quantity, delivery_date, delivery_name, total_amount,
             customers(id, name)`)
    .eq("payment_status" as never, "代未")
    .not("status", "eq", "キャンセル")
    .not("status", "eq", "履歴")
    .order("delivery_date", { ascending: true });

  type UnpaidOrder = {
    id: string; status: string; order_type: string | null;
    created_at: string; product_name: string | null; quantity: number;
    delivery_date: string | null; delivery_name: string; total_amount: number | null;
    customers: { id: string; name: string } | null;
    payment_plan?: string | null;
  };

  const unpaidOrders = (unpaidData ?? []) as unknown as UnpaidOrder[];

  // ステータス別件数（アクティブのみ）
  const statusCounts = ACTIVE_STATUSES.reduce(
    (acc, s) => {
      acc[s] = orders.filter((o) => o.status === s).length;
      return acc;
    },
    {} as Record<OrderStatus, number>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>

      {/* ─── 1. 対応中の全注文 ─── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">対応中の注文</h2>
            <p className="text-xs text-gray-400 mt-0.5">完了・キャンセルを除く全注文</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-brand-700">
              {orders.length}
              <span className="text-sm font-normal text-gray-500 ml-1">件</span>
            </span>
            <Link
              href="/admin/orders?searched=1"
              className="text-xs text-brand-600 hover:underline whitespace-nowrap"
            >
              すべて見る →
            </Link>
          </div>
        </div>

        {/* ステータス別件数グリッド */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ACTIVE_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/orders?status=${encodeURIComponent(status)}&searched=1`}
              className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
                statusCounts[status] > 0
                  ? "bg-white border-gray-200 hover:bg-brand-50 hover:border-brand-200"
                  : "bg-gray-50 border-transparent opacity-50"
              }`}
            >
              <StatusBadge status={status} size="sm" />
              <span
                className={`text-xl font-bold mt-1.5 ${
                  statusCounts[status] > 0 ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {statusCounts[status]}
              </span>
              <span className="text-xs text-gray-400">件</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── 2. 今日の新着注文 ─── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">今日の新着注文</h2>
            <p className="text-xs text-gray-400 mt-0.5">本日受け付けた注文</p>
          </div>
          <span className="text-lg font-bold text-brand-700">
            {todayOrders.length}
            <span className="text-xs font-normal text-gray-500 ml-1">件</span>
          </span>
        </div>

        {todayOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm">本日の新着注文はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {todayOrders.map((order) => {
              const customer = order.customers as { id: string; name: string } | null;
              return (
                <div
                  key={order.id}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(order as { order_type?: string }).order_type && (
                        <OrderTypeBadge
                          type={(order as { order_type: string }).order_type as OrderType}
                          size="sm"
                        />
                      )}
                      {customer ? (
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-sm font-semibold text-brand-700 hover:underline truncate"
                        >
                          {customer.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">—</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatJstTime(order.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.product_name ?? `${order.quantity}点`}
                      {order.delivery_date && (
                        <span className="ml-2 text-gray-400">
                          お届け:{" "}
                          {new Date(order.delivery_date).toLocaleDateString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            month: "numeric",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={order.status as OrderStatus} size="sm" />
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-xs text-brand-600 hover:underline whitespace-nowrap font-medium"
                  >
                    詳細
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 3. 受付中（要対応） ─── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              受付中
              {pendingOrders.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {pendingOrders.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">確認・対応が必要な新規受付</p>
          </div>
          <Link
            href={`/admin/orders?status=${encodeURIComponent("受付")}&searched=1`}
            className="text-xs text-brand-600 hover:underline whitespace-nowrap"
          >
            すべて見る →
          </Link>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm">対応待ちの受付はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingOrders.map((order) => {
              const customer = order.customers as { id: string; name: string } | null;
              const daysAgo = Math.floor(
                (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={order.id}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(order as { order_type?: string }).order_type && (
                        <OrderTypeBadge
                          type={(order as { order_type: string }).order_type as OrderType}
                          size="sm"
                        />
                      )}
                      {customer ? (
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-sm font-semibold text-brand-700 hover:underline truncate"
                        >
                          {customer.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">—</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.product_name ?? `${order.quantity}点`}
                      {order.delivery_date && (
                        <span className="ml-2 text-gray-400">
                          お届け:{" "}
                          {new Date(order.delivery_date).toLocaleDateString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            month: "numeric",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-xs whitespace-nowrap ${
                      daysAgo === 0
                        ? "text-brand-600 font-semibold"
                        : daysAgo <= 2
                        ? "text-amber-600"
                        : "text-red-500 font-semibold"
                    }`}
                  >
                    {daysAgo === 0 ? "今日" : `${daysAgo}日前`}
                  </span>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-xs text-brand-600 hover:underline whitespace-nowrap font-medium"
                  >
                    詳細
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* ─── 4. 代未（未請求） ─── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50 rounded-t-xl">
          <div>
            <h2 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              代未
              {unpaidOrders.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {unpaidOrders.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-amber-700 mt-0.5">支払いが完了していない注文</p>
          </div>
          <Link
            href="/admin/orders?searched=1"
            className="text-xs text-amber-700 hover:underline whitespace-nowrap"
          >
            注文一覧 →
          </Link>
        </div>

        {unpaidOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-sm">未収金の注文はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-amber-50">
            {unpaidOrders.map((order) => {
              const customer = order.customers;
              return (
                <div
                  key={order.id}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-amber-50/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.order_type && (
                        <OrderTypeBadge type={order.order_type as OrderType} size="sm" />
                      )}
                      {customer ? (
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-sm font-semibold text-brand-700 hover:underline truncate"
                        >
                          {customer.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">—</span>
                      )}
                      <StatusBadge status={order.status as OrderStatus} size="sm" />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.product_name ?? `${order.quantity}点`}
                      {order.delivery_date && (
                        <span className="ml-2 text-gray-400">
                          お届け:{" "}
                          {new Date(order.delivery_date).toLocaleDateString("ja-JP", {
                            month: "numeric", day: "numeric",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {order.total_amount != null && (
                      <span className="text-sm font-bold text-amber-700">
                        ¥{order.total_amount.toLocaleString("ja-JP")}
                      </span>
                    )}
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-xs text-brand-600 hover:underline font-medium"
                    >
                      詳細
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 合計金額 */}
        {unpaidOrders.length > 0 && (
          <div className="px-5 py-3 border-t border-amber-100 bg-amber-50 flex justify-between items-center rounded-b-xl">
            <span className="text-xs text-amber-700 font-medium">未収合計</span>
            <span className="text-base font-bold text-amber-800">
              ¥{unpaidOrders
                .reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
                .toLocaleString("ja-JP")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
