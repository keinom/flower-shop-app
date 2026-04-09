import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import { ORDER_STATUSES } from "@/lib/constants";
import { updateOrderStatus } from "./actions";
import type { OrderStatus, OrderType } from "@/types";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; created?: string }>;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(id, name)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { data: logs } = await supabase
    .from("order_status_logs")
    .select("*, profiles(display_name)")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, product_name, description, quantity, unit_price, tax_rate")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = order.customers as { id: string; name: string } | null;

  // 次に選べるステータス（同じステータスは除外）
  const selectableStatuses = ORDER_STATUSES.filter(
    (s) => s !== order.status
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文詳細</h1>
        {(order as { order_type?: string }).order_type && (
          <OrderTypeBadge type={(order as { order_type: string }).order_type as OrderType} />
        )}
        <StatusBadge status={order.status as OrderStatus} />
        {(order as { recurring_template_id?: string }).recurring_template_id && (
          <Link
            href={`/admin/recurring/${(order as { recurring_template_id: string }).recurring_template_id}`}
            className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium hover:bg-violet-200 transition-colors"
          >
            🔄 定期注文
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/orders/${id}/delivery-note?type=standard`}
            target="_blank"
            className="text-xs font-medium px-3 py-1.5 rounded-md border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 transition-colors"
          >
            🖨 自社宛
          </Link>
          <Link
            href={`/orders/${id}/delivery-note?type=gift`}
            target="_blank"
            className="text-xs font-medium px-3 py-1.5 rounded-md border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 transition-colors"
          >
            🖨 ギフト用
          </Link>
          <Link
            href={`/admin/orders/${id}/edit`}
            className="btn-secondary text-sm"
          >
            ✏️ 編集
          </Link>
        </div>
      </div>

      {sp.created && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          注文を作成しました
        </div>
      )}
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
        {/* 注文内容 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">注文内容</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="顧客名">
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
            </InfoRow>
            <InfoRow label="注文日">
              {new Date(order.created_at).toLocaleDateString("ja-JP")}
            </InfoRow>
            <InfoRow label="商品名">{order.product_name ?? "—"}</InfoRow>
            <InfoRow label="数量">{order.quantity} 点</InfoRow>
            <InfoRow label="用途">{order.purpose}</InfoRow>
          </dl>
        </div>

        {/* お届け情報 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">お届け情報</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="お届け先名">{order.delivery_name}</InfoRow>
            <InfoRow label="お届け先住所">{order.delivery_address ?? "—"}</InfoRow>
            <InfoRow label="電話番号">{(order as { delivery_phone?: string | null }).delivery_phone ?? "—"}</InfoRow>
            <InfoRow label="メールアドレス">{(order as { delivery_email?: string | null }).delivery_email ?? "—"}</InfoRow>
            <InfoRow label="お届け希望日">
              {order.delivery_date
                ? <>
                    {new Date(order.delivery_date).toLocaleDateString("ja-JP", {
                      year: "numeric", month: "long", day: "numeric", weekday: "short",
                    })}
                    {formatDeliveryTime(
                      (order as { delivery_time_start?: string | null }).delivery_time_start ?? null,
                      (order as { delivery_time_end?: string | null }).delivery_time_end ?? null
                    ) && (
                      <span className="ml-2 text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {formatDeliveryTime(
                          (order as { delivery_time_start?: string | null }).delivery_time_start ?? null,
                          (order as { delivery_time_end?: string | null }).delivery_time_end ?? null
                        )}
                      </span>
                    )}
                  </>
                : "—"}
            </InfoRow>
          </dl>
        </div>
      </div>

      {/* 商品明細 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">商品明細</h2>
        {orderItems && orderItems.length > 0 ? (
          <>
            <div className="table-container">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th className="th">商品名 / 説明</th>
                    <th className="th text-right">数量</th>
                    <th className="th text-right">単価（税抜）</th>
                    <th className="th text-right">小計（税込）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderItems.map((item) => {
                    const excl = item.quantity * item.unit_price;
                    const tax  = Math.round(excl * item.tax_rate / 100);
                    return (
                      <tr key={item.id}>
                        <td className="td">
                          <p className="font-medium">{item.product_name}</p>
                          {(item as { description?: string | null }).description && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {(item as { description: string }).description}
                            </p>
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
            {/* 税込合計サマリー */}
            {(() => {
              const totalExcl = orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
              const taxRate   = orderItems[0].tax_rate;
              const taxAmt    = Math.round(totalExcl * taxRate / 100);
              return (
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
                    <span>¥{(totalExcl + taxAmt).toLocaleString("ja-JP")}</span>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <p className="text-sm text-gray-400">明細データがありません</p>
        )}
      </div>

      {/* メッセージカード・備考 */}
      {(order.message_card || order.remarks) && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            メッセージ・備考
          </h2>
          {order.message_card && (
            <div className="text-sm">
              <p className="text-xs text-gray-500 mb-1">メッセージカード内容</p>
              <p className="bg-gray-50 rounded p-3 text-gray-800 whitespace-pre-wrap">
                {order.message_card}
              </p>
            </div>
          )}
          {order.remarks && (
            <div className="text-sm">
              <p className="text-xs text-gray-500 mb-1">備考</p>
              <p className="bg-gray-50 rounded p-3 text-gray-800 whitespace-pre-wrap">
                {order.remarks}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ステータス更新 */}
      {order.status !== "配達完了" && order.status !== "キャンセル" && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">ステータスを更新</h2>
          <p className="text-xs text-gray-500 mb-4">
            現在: <StatusBadge status={order.status as OrderStatus} size="sm" />
          </p>
          <form action={updateOrderStatus} className="space-y-4">
            <input type="hidden" name="order_id" value={order.id} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">新しいステータス</label>
                <select name="new_status" required className="input">
                  <option value="">選択してください</option>
                  {selectableStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  変更メモ{" "}
                  <span className="text-gray-400 text-xs font-normal">（任意）</span>
                </label>
                <input
                  name="note"
                  type="text"
                  placeholder="例: 午前中に配達予定"
                  className="input"
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              ステータスを更新する
            </button>
          </form>
        </div>
      )}

      {/* ステータス変更履歴 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">変更履歴</h2>
        {!logs || logs.length === 0 ? (
          <p className="text-sm text-gray-400">変更履歴がありません</p>
        ) : (
          <ol className="space-y-3">
            {logs.map((log) => {
              const changedBy =
                (log.profiles as { display_name: string | null } | null)
                  ?.display_name ?? "管理者";
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      {log.old_status && (
                        <>
                          <StatusBadge
                            status={log.old_status as OrderStatus}
                            size="sm"
                          />
                          <span className="text-gray-400">→</span>
                        </>
                      )}
                      <StatusBadge
                        status={log.new_status as OrderStatus}
                        size="sm"
                      />
                    </div>
                    {log.note && (
                      <p className="text-gray-600 mt-0.5">{log.note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString("ja-JP")} /{" "}
                      {changedBy}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function formatDeliveryTime(start: string | null, end: string | null): string | null {
  const fmt = (t: string) => t.slice(0, 5);
  if (!start && !end) return null;
  if (!start) return `〜${fmt(end!)}`;
  if (!end)   return `${fmt(start)}〜`;
  return `${fmt(start)}〜${fmt(end)}`;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">
        {children ?? <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}
