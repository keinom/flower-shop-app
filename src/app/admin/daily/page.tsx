import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DailyDatePicker } from "@/components/admin/DailyDatePicker";
import type { OrderStatus } from "@/types";

interface DailyPageProps {
  searchParams: Promise<{ date?: string }>;
}

// 日付文字列 "YYYY-MM-DD" を n 日ずらす
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// 表示用フォーマット
function formatDate(dateStr: string, today: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  if (dateStr === today) return `${label}（今日）`;
  if (dateStr === shiftDate(today, 1)) return `${label}（明日）`;
  return label;
}

// 時間帯フォーマット
function formatTimeRange(start: string | null, end: string | null): string | null {
  const fmt = (t: string) => t.slice(0, 5);
  if (!start && !end) return null;
  if (!start) return `〜${fmt(end!)}`;
  if (!end)   return `${fmt(start)}〜`;
  return `${fmt(start)}〜${fmt(end)}`;
}

// 今日の日付（JST）
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

export default async function DailyPage({ searchParams }: DailyPageProps) {
  const sp = await searchParams;
  const today = getTodayJST();
  const baseDate = sp.date ?? today;
  const date2    = shiftDate(baseDate, 1);

  const supabase = await createClient();

  // 2日分の注文を取得
  const { data: allOrders } = await supabase
    .from("orders")
    .select("*, customers(id, name)")
    .in("delivery_date", [baseDate, date2])
    .order("delivery_time_start", { ascending: true, nullsFirst: false })
    .order("created_at",          { ascending: true });

  const orders1 = allOrders?.filter((o) => o.delivery_date === baseDate) ?? [];
  const orders2 = allOrders?.filter((o) => o.delivery_date === date2)    ?? [];

  const prevDate = shiftDate(baseDate, -1);
  const nextDate = shiftDate(baseDate,  1);

  return (
    <div className="space-y-5">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">日報</h1>

        {/* ナビゲーション */}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DayColumn
          dateStr={baseDate}
          today={today}
          orders={orders1}
        />
        <DayColumn
          dateStr={date2}
          today={today}
          orders={orders2}
        />
      </div>
    </div>
  );
}

// ── 1日分のカラム ──
function DayColumn({
  dateStr,
  today,
  orders,
}: {
  dateStr: string;
  today: string;
  orders: {
    id: string;
    status: string;
    product_name: string | null;
    quantity: number;
    delivery_address: string | null;
    delivery_time_start?: string | null;
    delivery_time_end?: string | null;
    total_amount?: number | null;
    customers: { id: string; name: string } | null;
  }[];
}) {
  const isToday    = dateStr === today;
  const isTomorrow = dateStr === shiftDate(today, 1);

  return (
    <div className="card overflow-hidden">
      {/* カラムヘッダー */}
      <div
        className={`px-5 py-3 border-b flex items-center justify-between ${
          isToday
            ? "bg-brand-600 text-white"
            : isTomorrow
            ? "bg-brand-50 border-brand-200"
            : "bg-gray-50"
        }`}
      >
        <div>
          <p className={`text-xs font-medium ${isToday ? "text-brand-100" : "text-gray-500"}`}>
            {isToday ? "今日" : isTomorrow ? "明日" : ""}
          </p>
          <p className={`text-sm font-bold ${isToday ? "text-white" : "text-gray-800"}`}>
            {new Date(dateStr + "T00:00:00").toLocaleDateString("ja-JP", {
              year: "numeric", month: "long", day: "numeric", weekday: "short",
            })}
          </p>
        </div>
        <div
          className={`text-2xl font-bold ${isToday ? "text-white" : "text-brand-700"}`}
        >
          {orders.length}
          <span className={`text-xs font-normal ml-1 ${isToday ? "text-brand-100" : "text-gray-500"}`}>
            件
          </span>
        </div>
      </div>

      {/* 注文リスト */}
      {orders.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400 text-sm">
          配達予定の注文はありません
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map((order) => {
            const customer  = order.customers as { id: string; name: string } | null;
            const timeRange = formatTimeRange(
              (order as { delivery_time_start?: string | null }).delivery_time_start ?? null,
              (order as { delivery_time_end?: string | null }).delivery_time_end ?? null
            );
            const totalAmount = (order as { total_amount?: number | null }).total_amount;

            return (
              <div key={order.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                {/* 上段：時間帯 + ステータス + 詳細リンク */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {timeRange ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                        🕐 {timeRange}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-400">
                        時間未定
                      </span>
                    )}
                    <StatusBadge status={order.status as OrderStatus} size="sm" />
                  </div>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-xs text-brand-600 hover:underline flex-shrink-0"
                  >
                    詳細 →
                  </Link>
                </div>

                {/* 顧客名 */}
                <p className="font-semibold text-gray-900 text-sm">
                  {customer ? (
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="hover:text-brand-700 hover:underline"
                    >
                      {customer.name}
                    </Link>
                  ) : "—"}
                </p>

                {/* 商品 */}
                <p className="text-xs text-gray-600 mt-0.5">
                  {order.product_name ?? `${order.quantity}点`}
                </p>

                {/* 住所 + 金額 */}
                <div className="flex items-end justify-between mt-1.5 gap-2">
                  {order.delivery_address ? (
                    <p className="text-xs text-gray-400 truncate">
                      📍 {order.delivery_address}
                    </p>
                  ) : (
                    <span />
                  )}
                  {totalAmount != null && totalAmount > 0 && (
                    <p className="text-xs font-semibold text-brand-700 flex-shrink-0">
                      ¥{totalAmount.toLocaleString("ja-JP")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* フッター：合計 */}
      {orders.length > 0 && (
        <div className="px-5 py-2.5 border-t bg-gray-50 flex justify-between items-center text-sm">
          <span className="text-gray-500">合計金額（税込）</span>
          <span className="font-bold text-brand-700">
            ¥{orders
              .reduce((sum, o) => sum + (((o as { total_amount?: number | null }).total_amount) ?? 0), 0)
              .toLocaleString("ja-JP")}
          </span>
        </div>
      )}
    </div>
  );
}
