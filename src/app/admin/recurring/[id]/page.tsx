import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import { describeRecurrence, getNextOccurrences } from "@/lib/recurring";
import type { RecurrenceRule } from "@/lib/recurring";
import type { OrderStatus, OrderType } from "@/types";
import { toggleTemplateActive, deleteTemplate, runManualGeneration } from "./actions";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function RecurringTemplateDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("recurring_order_templates")
    .select("*, customers(id, name, phone, email, address), recurring_order_template_items(*)")
    .eq("id", id)
    .single();

  if (!template) notFound();

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, status, delivery_date, product_name, quantity, total_amount, created_at")
    .eq("recurring_template_id", id)
    .order("delivery_date", { ascending: false })
    .limit(10);

  const customer = template.customers as { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null;
  const rawItems = template.recurring_order_template_items;
  const items = (Array.isArray(rawItems) ? rawItems : []) as Array<{
    id: string;
    product_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    sort_order: number;
  }>;

  const rule: RecurrenceRule = {
    recurrence_type: template.recurrence_type as RecurrenceRule['recurrence_type'],
    weekly_days: template.weekly_days,
    monthly_day: template.monthly_day,
    monthly_week: template.monthly_week,
    monthly_weekday: template.monthly_weekday,
    interval_days: template.interval_days,
    start_date: template.start_date,
    end_date: template.end_date,
  };

  const description = describeRecurrence(rule);
  const nextOccurrences = getNextOccurrences(rule, new Date(), 5);

  const totalExcl = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxRate = items[0]?.tax_rate ?? 10;
  const taxAmt = Math.round(totalExcl * taxRate / 100);
  const totalIncl = totalExcl + taxAmt;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/admin/recurring" className="text-sm text-gray-500 hover:text-gray-700 mt-1">
          ← 定期注文
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{template.title}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                template.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {template.is_active ? "有効" : "停止中"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <form action={runManualGeneration}>
            <input type="hidden" name="template_id" value={template.id} />
            <button type="submit" className="btn-secondary text-xs">
              🔄 今すぐ生成（30日分）
            </button>
          </form>
          <form action={toggleTemplateActive}>
            <input type="hidden" name="template_id" value={template.id} />
            <input type="hidden" name="is_active" value={String(template.is_active)} />
            <button
              type="submit"
              className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
                template.is_active
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                  : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              }`}
            >
              {template.is_active ? "⏸ 停止" : "▶ 再開"}
            </button>
          </form>
          <form action={deleteTemplate} onSubmit={() => confirm("このテンプレートを削除しますか？")}>
            <input type="hidden" name="template_id" value={template.id} />
            <button
              type="submit"
              className="text-xs font-medium px-3 py-1.5 rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors"
            >
              🗑 削除
            </button>
          </form>
        </div>
      </div>

      {sp.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {decodeURIComponent(sp.success)}
        </div>
      )}
      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* 顧客情報 */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">顧客情報</h2>
          {customer ? (
            <div className="text-sm space-y-2">
              <p>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {customer.name}
                </Link>
              </p>
              {customer.phone && <p className="text-gray-600">📞 {customer.phone}</p>}
              {customer.email && <p className="text-gray-600">✉ {customer.email}</p>}
              {customer.address && <p className="text-gray-600">📍 {customer.address}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">顧客情報なし</p>
          )}
        </div>

        {/* 繰り返し設定 */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">繰り返し設定</h2>
          <div className="text-sm space-y-2">
            <p className="font-medium text-brand-800">{description}</p>
            <p className="text-gray-500">
              開始日: {new Date(template.start_date).toLocaleDateString("ja-JP")}
              {template.end_date && (
                <> ／ 終了日: {new Date(template.end_date).toLocaleDateString("ja-JP")}</>
              )}
            </p>
            {template.last_generated_date && (
              <p className="text-xs text-gray-400">
                最終生成日: {new Date(template.last_generated_date).toLocaleDateString("ja-JP")}
              </p>
            )}
          </div>
          {nextOccurrences.length > 0 && (
            <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-brand-700 mb-2">次回の予定（直近5回）</p>
              <ul className="space-y-1">
                {nextOccurrences.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-brand-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                    {d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 注文テンプレート詳細 */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">注文テンプレート詳細</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">注文種別</p>
            <div className="mt-0.5">
              <OrderTypeBadge type={template.order_type as OrderType} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">お届け先名</p>
            <p className="mt-0.5 font-medium text-gray-900">{template.delivery_name}</p>
          </div>
          {template.delivery_address && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">お届け先住所</p>
              <p className="mt-0.5 text-gray-900">{template.delivery_address}</p>
            </div>
          )}
          {template.delivery_phone && (
            <div>
              <p className="text-xs text-gray-500">電話番号</p>
              <p className="mt-0.5 text-gray-900">{template.delivery_phone}</p>
            </div>
          )}
          {template.delivery_email && (
            <div>
              <p className="text-xs text-gray-500">メールアドレス</p>
              <p className="mt-0.5 text-gray-900">{template.delivery_email}</p>
            </div>
          )}
          {(template.delivery_time_start || template.delivery_time_end) && (
            <div>
              <p className="text-xs text-gray-500">希望時間帯</p>
              <p className="mt-0.5 text-gray-900">
                {template.delivery_time_start?.slice(0, 5) || "—"} 〜 {template.delivery_time_end?.slice(0, 5) || "—"}
              </p>
            </div>
          )}
          {template.purpose && (
            <div>
              <p className="text-xs text-gray-500">用途</p>
              <p className="mt-0.5 text-gray-900">{template.purpose}</p>
            </div>
          )}
        </div>

        {/* 商品明細 */}
        {items.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">商品明細</h3>
            <div className="table-container">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th className="th">商品名</th>
                    <th className="th text-right">数量</th>
                    <th className="th text-right">単価（税抜）</th>
                    <th className="th text-right">小計（税込）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...items].sort((a, b) => a.sort_order - b.sort_order).map((item) => {
                    const excl = item.quantity * item.unit_price;
                    const tax = Math.round(excl * item.tax_rate / 100);
                    return (
                      <tr key={item.id}>
                        <td className="td">
                          <p className="font-medium">{item.product_name}</p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                          )}
                        </td>
                        <td className="td text-right">{item.quantity}</td>
                        <td className="td text-right">¥{item.unit_price.toLocaleString("ja-JP")}</td>
                        <td className="td text-right font-medium">
                          ¥{(excl + tax).toLocaleString("ja-JP")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-3 border-t space-y-1 text-sm">
              <div className="flex justify-end gap-8 text-gray-600">
                <span>小計（税抜）</span>
                <span>¥{totalExcl.toLocaleString("ja-JP")}</span>
              </div>
              <div className="flex justify-end gap-8 text-gray-600">
                <span>消費税（{taxRate}%）</span>
                <span>¥{taxAmt.toLocaleString("ja-JP")}</span>
              </div>
              <div className="flex justify-end gap-8 font-bold text-base text-brand-700 pt-1 border-t">
                <span>合計（税込）</span>
                <span>¥{totalIncl.toLocaleString("ja-JP")}</span>
              </div>
            </div>
          </div>
        )}

        {template.message_card && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">メッセージカード</p>
            <p className="text-sm bg-gray-50 rounded p-3 text-gray-800 whitespace-pre-wrap">
              {template.message_card}
            </p>
          </div>
        )}
        {template.remarks && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">備考</p>
            <p className="text-sm bg-gray-50 rounded p-3 text-gray-800 whitespace-pre-wrap">
              {template.remarks}
            </p>
          </div>
        )}
      </div>

      {/* 生成済み注文一覧 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">
          生成済み注文（直近10件）
        </h2>
        {!recentOrders || recentOrders.length === 0 ? (
          <p className="text-sm text-gray-400">まだ注文が生成されていません</p>
        ) : (
          <div className="table-container">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th className="th">お届け日</th>
                  <th className="th">商品名</th>
                  <th className="th text-right">合計</th>
                  <th className="th">ステータス</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="td text-gray-700">
                      {order.delivery_date
                        ? new Date(order.delivery_date).toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            weekday: "short",
                          })
                        : "—"}
                    </td>
                    <td className="td text-gray-700">
                      {order.product_name ?? `${order.quantity}点`}
                    </td>
                    <td className="td text-right text-gray-700">
                      {order.total_amount != null
                        ? `¥${order.total_amount.toLocaleString("ja-JP")}`
                        : "—"}
                    </td>
                    <td className="td">
                      <StatusBadge status={order.status as OrderStatus} size="sm" />
                    </td>
                    <td className="td text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
