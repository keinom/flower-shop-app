import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DailyDatePicker } from "@/components/admin/DailyDatePicker";
import type { OrderStatus } from "@/types";

interface DailyPageProps {
  searchParams: Promise<{ date?: string }>;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatTimeRange(start: string | null, end: string | null): string | null {
  const fmt = (t: string) => t.slice(0, 5);
  if (!start && !end) return null;
  if (!start) return `〜${fmt(end!)}`;
  if (!end)   return `${fmt(start)}〜`;
  return `${fmt(start)}〜${fmt(end)}`;
}

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

type OrderRow = {
  id: string;
  status: string;
  product_name: string | null;
  quantity: number;
  delivery_name: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_time_start: string | null;
  delivery_time_end: string | null;
  total_amount: number | null;
  customers: { id: string; name: string } | null;
};

export default async function DailyPage({ searchParams }: DailyPageProps) {
  const sp = await searchParams;
  const today    = getTodayJST();
  const baseDate = sp.date ?? today;
  const date2    = shiftDate(baseDate, 1);
  const prevDate = shiftDate(baseDate, -1);
  const nextDate = shiftDate(baseDate,  1);

  const supabase = await createClient();

  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, status, product_name, quantity, delivery_name, delivery_address, delivery_phone, delivery_date, delivery_time_start, delivery_time_end, total_amount, customers(id, name)")
    .in("delivery_date", [baseDate, date2])
    .not("status", "eq", "キャンセル")
    .order("delivery_time_start", { ascending: true, nullsFirst: false })
    .order("created_at",          { ascending: true });

  const orders1 = (allOrders ?? []).filter((o) => o.delivery_date === baseDate) as unknown as OrderRow[];
  const orders2 = (allOrders ?? []).filter((o) => o.delivery_date === date2)    as unknown as OrderRow[];

  return (
    <div className="space-y-5">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">日報</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/admin/daily?date=${prevDate}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            ← 前日
          </Link>
          <DailyDatePicker currentDate={baseDate} />
          <Link
            href={`/admin/daily?date=${nextDate}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            翌日 →
          </Link>
          {baseDate !== today && (
            <Link
              href="/admin/daily"
              className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors"
            >
              今日に戻る
            </Link>
          )}
        </div>
      </div>

      {/* ── 2日分グリッド ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <DayColumn dateStr={baseDate} today={today} orders={orders1} />
        <DayColumn dateStr={date2}    today={today} orders={orders2} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 1日分カラム
// ─────────────────────────────────────────
function DayColumn({
  dateStr,
  today,
  orders,
}: {
  dateStr: string;
  today: string;
  orders: OrderRow[];
}) {
  const isToday    = dateStr === today;
  const isTomorrow = dateStr === shiftDate(today, 1);

  const dayLabel = isToday ? "今日" : isTomorrow ? "明日" : "";
  const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <div className="card overflow-hidden">
      {/* カラムヘッダー */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between ${
          isToday
            ? "bg-brand-600 text-white"
            : isTomorrow
            ? "bg-brand-50 border-brand-200"
            : "bg-gray-50"
        }`}
      >
        <div>
          {dayLabel && (
            <p className={`text-xs font-semibold mb-0.5 ${isToday ? "text-brand-200" : "text-brand-600"}`}>
              {dayLabel}
            </p>
          )}
          <p className={`text-base font-bold ${isToday ? "text-white" : "text-gray-800"}`}>
            {dateLabel}
          </p>
        </div>
        <div className={`text-3xl font-black ${isToday ? "text-white" : "text-brand-700"}`}>
          {orders.length}
          <span className={`text-sm font-normal ml-1 ${isToday ? "text-brand-200" : "text-gray-500"}`}>
            件
          </span>
        </div>
      </div>

      {/* 注文リスト */}
      {orders.length === 0 ? (
        <div className="px-5 py-12 text-center text-gray-400">
          <p className="text-3xl mb-2">🌸</p>
          <p className="text-sm">配達予定の注文はありません</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map((order, idx) => (
            <OrderCard key={order.id} order={order} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 注文カード
// ─────────────────────────────────────────
function OrderCard({ order, index }: { order: OrderRow; index: number }) {
  const customer  = order.customers as { id: string; name: string } | null;
  const timeRange = formatTimeRange(order.delivery_time_start, order.delivery_time_end);

  // 顧客名と届け先名が同じ（自分への配達）かどうか
  const isSelfDelivery =
    customer && order.delivery_name.trim() === customer.name.trim();

  return (
    <div className="px-4 py-4 hover:bg-gray-50 transition-colors">

      {/* ── ①時間 + ステータス + 詳細リンク ── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 時間帯 */}
          {timeRange ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-base font-bold bg-amber-100 text-amber-800">
              🕐 {timeRange}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm bg-gray-100 text-gray-400 font-medium">
              時間未定
            </span>
          )}
          {/* ステータス */}
          <StatusBadge status={order.status as OrderStatus} size="md" />
        </div>
        <Link
          href={`/admin/orders/${order.id}`}
          className="text-sm text-brand-600 hover:underline flex-shrink-0 font-medium"
        >
          詳細 →
        </Link>
      </div>

      {/* ── ②顧客 → 届け先 ── */}
      <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-1.5">
        {isSelfDelivery ? (
          /* 同一：「自分への配達」表示 */
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">注文・届け先</span>
              <span className="text-base font-bold text-gray-900">
                {customer ? (
                  <Link href={`/admin/customers/${customer.id}`} className="hover:text-brand-700 hover:underline">
                    {customer.name}
                  </Link>
                ) : order.delivery_name}
              </span>
              <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                自社宛
              </span>
            </div>
            {order.delivery_address && (
              <p className="text-xs text-gray-500 pl-14">📍 {order.delivery_address}</p>
            )}
            {order.delivery_phone && (
              <p className="text-xs text-gray-500 pl-14">📞 {order.delivery_phone}</p>
            )}
          </div>
        ) : (
          /* 別：顧客 → 届け先 */
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">注文元</span>
              <span className="text-base font-bold text-gray-900">
                {customer ? (
                  <Link href={`/admin/customers/${customer.id}`} className="hover:text-brand-700 hover:underline">
                    {customer.name}
                  </Link>
                ) : "—"}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12 flex-shrink-0">届け先</span>
                <span className="text-base font-semibold text-brand-800">
                  {order.delivery_name}
                </span>
              </div>
              {order.delivery_address && (
                <p className="text-xs text-gray-500 pl-14">📍 {order.delivery_address}</p>
              )}
              {order.delivery_phone && (
                <p className="text-xs text-gray-500 pl-14">📞 {order.delivery_phone}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── ③商品 + 金額 ── */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700">
          {order.product_name ?? `${order.quantity}点`}
        </p>
        {order.total_amount != null && (
          <p className="text-sm font-bold text-brand-700 flex-shrink-0">
            ¥{order.total_amount.toLocaleString("ja-JP")}
          </p>
        )}
      </div>
    </div>
  );
}
