import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import { DailyDatePicker } from "@/components/admin/DailyDatePicker";
import { DailyViewToggle } from "@/components/admin/DailyViewToggle";
import { InlineStatusSelect } from "@/components/admin/InlineStatusSelect";
import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus, OrderType } from "@/types";

interface DailyPageProps {
  searchParams: Promise<{ date?: string; view?: string }>;
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
  order_type: string | null;
  delivery_date: string;
  delivery_time_start: string | null;
  delivery_time_end: string | null;
  total_amount: number | null;
  customers: { id: string; name: string } | null;
};

// 注文種別ごとの左ボーダー色（inline style用）
const TYPE_BORDER_COLOR: Record<string, string> = {
  来店:    "#38bdf8",
  配達:    "#34d399",
  発送:    "#a78bfa",
  生け込み: "#fbbf24",
};

export default async function DailyPage({ searchParams }: DailyPageProps) {
  const sp      = await searchParams;
  const today    = getTodayJST();
  const baseDate = sp.date ?? today;
  const view     = sp.view ?? "1";
  const date2    = shiftDate(baseDate, 1);
  const prevDate = shiftDate(baseDate, -1);
  const nextDate = shiftDate(baseDate,  1);

  const supabase = await createClient();

  const datesToFetch = view === "2" ? [baseDate, date2] : [baseDate];

  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, status, order_type, product_name, quantity, delivery_name, delivery_address, delivery_phone, delivery_date, delivery_time_start, delivery_time_end, total_amount, customers(id, name)")
    .in("delivery_date", datesToFetch)
    .not("status", "eq", "キャンセル")
    .order("delivery_time_start", { ascending: true, nullsFirst: false })
    .order("created_at",          { ascending: true });

  const orders1 = (allOrders ?? []).filter((o: any) => o.delivery_date === baseDate) as unknown as OrderRow[];
  const orders2 = view === "2"
    ? (allOrders ?? []).filter((o: any) => o.delivery_date === date2) as unknown as OrderRow[]
    : [];

  const linkClass = "px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors";

  return (
    <div className="space-y-5">
      {/* ── 行1: タイトル ＋ 表示切替 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">日報</h1>
        <DailyViewToggle currentView={view} currentDate={baseDate} />
      </div>

      {/* ── 行2: 日付ナビ（前日 ← 日付 → 翌日） ── */}
      <div className="card px-4 py-3 flex items-center gap-3">
        <Link
          href={`/admin/daily?date=${prevDate}&view=${view}`}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-600 transition-colors flex-shrink-0"
        >
          ← 前日
        </Link>

        <div className="flex-1 flex items-center justify-center gap-3">
          <DailyDatePicker currentDate={baseDate} view={view} todayDate={today} />
          {baseDate !== today && (
            <Link
              href={`/admin/daily?view=${view}`}
              className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors font-medium"
            >
              今日に戻る
            </Link>
          )}
        </div>

        <Link
          href={`/admin/daily?date=${nextDate}&view=${view}`}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-600 transition-colors flex-shrink-0"
        >
          翌日 →
        </Link>
      </div>

      {/* ── ビュー切替 ── */}
      {view === "1" ? (
        <DaySingleFull dateStr={baseDate} today={today} orders={orders1} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <DayColumn dateStr={baseDate} today={today} orders={orders1} />
          <DayColumn dateStr={date2}    today={today} orders={orders2} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1日分フル表示
// ─────────────────────────────────────────────────────────────
function DaySingleFull({
  dateStr,
  today,
  orders,
}: {
  dateStr: string;
  today: string;
  orders: OrderRow[];
}) {
  // 発送 と それ以外（タイムライン）に分割
  const timelineOrders = orders.filter((o) => o.order_type !== "発送");
  const shippingOrders = orders.filter((o) => o.order_type === "発送");

  // ステータス別件数
  const statusCounts = ORDER_STATUSES.reduce(
    (acc, s) => { acc[s] = orders.filter((o) => o.status === s).length; return acc; },
    {} as Record<OrderStatus, number>
  );

  return (
    <div className="space-y-4">
      {/* ── ステータスサマリーカード ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">この日のお届け予定</h2>
          <span className="text-2xl font-bold text-brand-700">
            {orders.length}
            <span className="text-sm font-normal text-gray-500 ml-1">件</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
          {ORDER_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/orders?status=${encodeURIComponent(status)}&delivery_from=${dateStr}&delivery_to=${dateStr}&searched=1`}
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

      {/* ── 注文ゼロ ── */}
      {orders.length === 0 && (
        <div className="card px-6 py-20 text-center text-gray-400">
          <p className="text-5xl mb-4">🌸</p>
          <p className="text-base">この日の注文はありません</p>
        </div>
      )}

      {/* ── タイムライン（来店・配達・生け込み）── */}
      {timelineOrders.length > 0 && (
        <div className="card overflow-hidden divide-y divide-gray-100">
          {timelineOrders.map((order, idx) => (
            <OrderCard1Day key={order.id} order={order} index={idx} />
          ))}
        </div>
      )}

      {/* ── 発送セクション ── */}
      {shippingOrders.length > 0 && (
        <ShippingSection orders={shippingOrders} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 発送まとめセクション
// ─────────────────────────────────────────────────────────────
function ShippingSection({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="card overflow-hidden">
      {/* セクションヘッダー */}
      <div className="px-6 py-4 bg-violet-50 border-b border-violet-100 flex items-center gap-3">
        <span className="text-2xl">📦</span>
        <p className="text-lg font-bold text-violet-900">
          発送
          <span className="text-3xl font-black ml-3">{orders.length}</span>
          <span className="text-base font-normal ml-1 text-violet-500">件</span>
        </p>
      </div>

      {/* 発送カード一覧 */}
      <div className="divide-y divide-violet-50">
        {orders.map((order, idx) => (
          <ShippingCard key={order.id} order={order} index={idx} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 発送カード（コンパクト）
// ─────────────────────────────────────────────────────────────
function ShippingCard({ order, index }: { order: OrderRow; index: number }) {
  const customer = order.customers as { id: string; name: string } | null;
  const isSelfDelivery =
    customer && order.delivery_name.trim() === customer.name.trim();

  return (
    <div
      className="px-5 py-4 hover:bg-violet-50/50 transition-colors"
      style={{ borderLeft: "4px solid #a78bfa" }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* 左：届け先情報 */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* 注文元 */}
          {!isSelfDelivery && customer && (
            <p className="text-sm text-gray-400">
              注文元：
              <Link
                href={`/admin/customers/${customer.id}`}
                className="text-gray-600 hover:text-brand-700 hover:underline font-medium"
              >
                {customer.name}
              </Link>
            </p>
          )}

          {/* 届け先名 */}
          <p className="text-lg font-bold text-violet-900">
            {isSelfDelivery && customer ? (
              <Link
                href={`/admin/customers/${customer.id}`}
                className="hover:text-brand-700 hover:underline"
              >
                {customer.name}
              </Link>
            ) : (
              order.delivery_name
            )}
          </p>

          {/* 住所 / 電話 */}
          {order.delivery_address && (
            <p className="text-sm text-gray-500 truncate">📍 {order.delivery_address}</p>
          )}
          {order.delivery_phone && (
            <p className="text-sm text-gray-500">📞 {order.delivery_phone}</p>
          )}

          {/* 商品 */}
          <p className="text-sm font-medium text-gray-600">
            {order.product_name ?? `${order.quantity}点`}
          </p>
        </div>

        {/* 右：ステータス・詳細 */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <InlineStatusSelect orderId={order.id} currentStatus={order.status as OrderStatus} />
          <Link
            href={`/admin/orders/${order.id}`}
            className="text-sm text-brand-600 hover:underline font-semibold"
          >
            詳細 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1日分フル表示用カード
// ─────────────────────────────────────────────────────────────
function OrderCard1Day({ order, index }: { order: OrderRow; index: number }) {
  const customer  = order.customers as { id: string; name: string } | null;
  const timeRange = formatTimeRange(order.delivery_time_start, order.delivery_time_end);
  const type      = order.order_type ?? "配達";
  const borderColor = TYPE_BORDER_COLOR[type] ?? "#d1d5db";

  const isSelfDelivery =
    customer && order.delivery_name.trim() === customer.name.trim();

  return (
    <div
      className="px-5 py-5 hover:bg-gray-50/80 transition-colors"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* ① 時間・種別・ステータス・詳細リンク */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          {order.order_type && (
            <OrderTypeBadge type={order.order_type as OrderType} size="md" />
          )}
          {timeRange ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xl font-bold bg-amber-50 text-amber-800 border border-amber-100">
              🕐 {timeRange}
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-lg text-base bg-gray-100 text-gray-400 font-medium">
              時間未定
            </span>
          )}
          <InlineStatusSelect orderId={order.id} currentStatus={order.status as OrderStatus} />
        </div>
        <Link
          href={`/admin/orders/${order.id}`}
          className="text-brand-600 hover:underline font-semibold text-base flex-shrink-0"
        >
          詳細 →
        </Link>
      </div>

      {/* ② 顧客 → 届け先 */}
      <div className="bg-gray-50 rounded-xl px-4 py-4 mb-3 space-y-2.5">
        {isSelfDelivery ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-16 flex-shrink-0">注文・届け先</span>
              <span className="text-lg font-bold text-gray-900">
                {customer ? (
                  <Link href={`/admin/customers/${customer.id}`} className="hover:text-brand-700 hover:underline">
                    {customer.name}
                  </Link>
                ) : order.delivery_name}
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">
                自社宛
              </span>
            </div>
            {order.delivery_address && (
              <p className="text-base text-gray-600 pl-[4.75rem]">📍 {order.delivery_address}</p>
            )}
            {order.delivery_phone && (
              <p className="text-base text-gray-600 pl-[4.75rem]">📞 {order.delivery_phone}</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-16 flex-shrink-0">注文元</span>
              <span className="text-base font-semibold text-gray-700">
                {customer ? (
                  <Link href={`/admin/customers/${customer.id}`} className="hover:text-brand-700 hover:underline">
                    {customer.name}
                  </Link>
                ) : "—"}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-16 flex-shrink-0">届け先</span>
                <span className="text-xl font-bold text-brand-800">{order.delivery_name}</span>
              </div>
              {order.delivery_address && (
                <p className="text-base text-gray-600 pl-[4.75rem]">📍 {order.delivery_address}</p>
              )}
              {order.delivery_phone && (
                <p className="text-base text-gray-600 pl-[4.75rem]">📞 {order.delivery_phone}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ③ 商品 + 金額 */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium text-gray-700">
          {order.product_name ?? `${order.quantity}点`}
        </p>
        {order.total_amount != null && (
          <p className="text-xl font-bold text-brand-700">
            ¥{order.total_amount.toLocaleString("ja-JP")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2日分グリッド用カラム（従来デザイン）
// ─────────────────────────────────────────────────────────────
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
  const dayLabel   = isToday ? "今日" : isTomorrow ? "明日" : "";

  const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <div className="card overflow-hidden">
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

      {orders.length === 0 ? (
        <div className="px-5 py-12 text-center text-gray-400">
          <p className="text-3xl mb-2">🌸</p>
          <p className="text-sm">配達予定の注文はありません</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map((order, idx) => (
            <OrderCard2Day key={order.id} order={order} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2日分グリッド用カード（従来デザイン）
// ─────────────────────────────────────────────────────────────
function OrderCard2Day({ order, index }: { order: OrderRow; index: number }) {
  const customer  = order.customers as { id: string; name: string } | null;
  const timeRange = formatTimeRange(order.delivery_time_start, order.delivery_time_end);

  const isSelfDelivery =
    customer && order.delivery_name.trim() === customer.name.trim();

  return (
    <div className="px-4 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {order.order_type && (
            <OrderTypeBadge type={order.order_type as OrderType} size="sm" />
          )}
          {timeRange ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-base font-bold bg-amber-100 text-amber-800">
              🕐 {timeRange}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm bg-gray-100 text-gray-400 font-medium">
              時間未定
            </span>
          )}
          <InlineStatusSelect orderId={order.id} currentStatus={order.status as OrderStatus} />
        </div>
        <Link
          href={`/admin/orders/${order.id}`}
          className="text-sm text-brand-600 hover:underline flex-shrink-0 font-medium"
        >
          詳細 →
        </Link>
      </div>

      <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-1.5">
        {isSelfDelivery ? (
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
              <p className="text-sm text-gray-500 pl-14">📍 {order.delivery_address}</p>
            )}
            {order.delivery_phone && (
              <p className="text-sm text-gray-500 pl-14">📞 {order.delivery_phone}</p>
            )}
          </div>
        ) : (
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
                <span className="text-base font-semibold text-brand-800">{order.delivery_name}</span>
              </div>
              {order.delivery_address && (
                <p className="text-sm text-gray-500 pl-14">📍 {order.delivery_address}</p>
              )}
              {order.delivery_phone && (
                <p className="text-sm text-gray-500 pl-14">📞 {order.delivery_phone}</p>
              )}
            </div>
          </>
        )}
      </div>

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
