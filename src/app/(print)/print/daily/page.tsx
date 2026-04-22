import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintBar } from "@/components/ui/PrintBar";

interface DailyPrintPageProps {
  searchParams: Promise<{ date?: string }>;
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

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function formatTime(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return "時間未定";
  if (!start) return `〜${formatTime(end)}`;
  if (!end)   return `${formatTime(start)}〜`;
  return `${formatTime(start)}〜${formatTime(end)}`;
}

// 種別の表示順・ラベル・色
const TYPE_CONFIG: { type: string; label: string; color: string; bg: string }[] = [
  { type: "生け込み", label: "生け込み", color: "#92400e", bg: "#fef3c7" },
  { type: "配達",    label: "配達",    color: "#065f46", bg: "#d1fae5" },
  { type: "来店",    label: "来店",    color: "#1e40af", bg: "#dbeafe" },
  { type: "発送",    label: "発送",    color: "#4c1d95", bg: "#ede9fe" },
];

const TYPE_ORDER = TYPE_CONFIG.map((c) => c.type);

export default async function DailyPrintPage({ searchParams }: DailyPrintPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  const date = sp.date ?? getTodayJST();

  const { data: rawOrders } = await supabase
    .from("orders")
    .select("id, status, order_type, product_name, quantity, delivery_name, delivery_address, delivery_phone, delivery_date, delivery_time_start, delivery_time_end, total_amount, customers(id, name)")
    .eq("delivery_date", date)
    .not("status", "eq", "キャンセル")
    .not("status", "eq", "履歴")
    .order("delivery_time_start", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const orders = (rawOrders ?? []) as unknown as OrderRow[];

  // 種別グループ化（TYPE_ORDER順）
  const groups: { type: string; label: string; color: string; bg: string; orders: OrderRow[] }[] = [];
  for (const cfg of TYPE_CONFIG) {
    const group = orders.filter((o) => (o.order_type ?? "配達") === cfg.type);
    if (group.length > 0) groups.push({ ...cfg, orders: group });
  }
  // 未知の種別を末尾に追加
  const knownTypes = new Set(TYPE_ORDER);
  const otherOrders = orders.filter((o) => !knownTypes.has(o.order_type ?? "配達") && o.order_type !== null);
  if (otherOrders.length > 0) {
    groups.push({ type: "その他", label: "その他", color: "#374151", bg: "#f3f4f6", orders: otherOrders });
  }

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const FONT = '"Hiragino Sans", "Yu Gothic", "Meiryo", "MS Gothic", sans-serif';

  return (
    <>
      <PrintBar title={`📋 日報 ${dateLabel}`} />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper { padding: 0 !important; }
          .no-print { display: none !important; }
        }

        @media screen {
          body { background: #e5e7eb !important; padding-top: 52px; }
          .print-wrapper {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px 16px 48px;
          }
          .print-page {
            background: white;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18);
            min-height: 297mm;
            padding: 12mm 12mm 12mm 12mm;
          }
        }

        body { font-family: ${FONT}; }

        /* ヘッダー */
        .rpt-header {
          border-bottom: 2.5px solid #111;
          padding-bottom: 5pt;
          margin-bottom: 8pt;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .rpt-title { font-size: 15pt; font-weight: bold; letter-spacing: 0.05em; }
        .rpt-date  { font-size: 11pt; font-weight: bold; }
        .rpt-total { font-size: 9pt; color: #555; }

        /* 種別セクション */
        .section { margin-bottom: 8pt; page-break-inside: avoid; }
        .section-head {
          display: flex;
          align-items: center;
          gap: 6pt;
          padding: 3pt 6pt;
          margin-bottom: 3pt;
          border-radius: 3pt;
        }
        .section-head-label {
          font-size: 10.5pt;
          font-weight: bold;
          letter-spacing: 0.1em;
        }
        .section-head-count {
          font-size: 9pt;
          margin-left: auto;
        }

        /* テーブル */
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
        }
        .orders-table th {
          background: #f3f4f6;
          border: 0.5pt solid #d1d5db;
          padding: 2.5pt 4pt;
          text-align: left;
          font-size: 7.5pt;
          font-weight: bold;
          color: #374151;
          white-space: nowrap;
        }
        .orders-table td {
          border: 0.5pt solid #d1d5db;
          padding: 3pt 4pt;
          vertical-align: top;
          line-height: 1.45;
        }
        .orders-table tr:nth-child(even) td { background: #fafafa; }

        .col-time    { width: 14%; white-space: nowrap; }
        .col-dest    { width: 24%; }
        .col-contact { width: 28%; }
        .col-product { width: 22%; }
        .col-amount  { width: 12%; text-align: right; white-space: nowrap; }

        .time-val    { font-size: 9pt; font-weight: bold; color: #1d4ed8; }
        .time-none   { font-size: 8pt; color: #9ca3af; }
        .name-main   { font-size: 9pt; font-weight: bold; }
        .name-sub    { font-size: 7.5pt; color: #6b7280; margin-top: 1pt; }
        .contact-addr { font-size: 7.5pt; color: #374151; }
        .contact-tel  { font-size: 7.5pt; color: #374151; margin-top: 1pt; }
        .product-name { font-size: 8pt; }
        .amount-val  { font-size: 9pt; font-weight: bold; }

        /* 合計行 */
        .summary-row {
          margin-top: 8pt;
          border-top: 1.5pt solid #374151;
          padding-top: 5pt;
          display: flex;
          justify-content: flex-end;
          gap: 20pt;
          font-size: 9pt;
        }
        .summary-item { display: flex; flex-direction: column; align-items: flex-end; gap: 1pt; }
        .summary-label { font-size: 7.5pt; color: #6b7280; }
        .summary-value { font-size: 11pt; font-weight: bold; }

        /* フッター */
        .rpt-footer {
          margin-top: 10pt;
          border-top: 0.5pt solid #d1d5db;
          padding-top: 4pt;
          font-size: 7pt;
          color: #9ca3af;
          text-align: right;
        }
      `}</style>

      <div className="print-wrapper">
        <div className="print-page">

          {/* ─── ヘッダー ─── */}
          <div className="rpt-header">
            <span className="rpt-title">日　報</span>
            <span className="rpt-date">{dateLabel}</span>
            <span className="rpt-total">合計 {orders.length} 件</span>
          </div>

          {/* ─── 注文なし ─── */}
          {orders.length === 0 && (
            <div style={{ textAlign: "center", padding: "40pt 0", color: "#9ca3af", fontSize: "11pt" }}>
              この日の注文はありません
            </div>
          )}

          {/* ─── 種別グループ ─── */}
          {groups.map((grp) => (
            <div key={grp.type} className="section">
              {/* セクションヘッダー */}
              <div className="section-head" style={{ backgroundColor: grp.bg }}>
                <span className="section-head-label" style={{ color: grp.color }}>
                  {grp.label}
                </span>
                <span className="section-head-count" style={{ color: grp.color }}>
                  {grp.orders.length} 件
                </span>
              </div>

              {/* 注文テーブル */}
              <table className="orders-table">
                <thead>
                  <tr>
                    <th className="col-time">時刻</th>
                    <th className="col-dest">届け先</th>
                    <th className="col-contact">住所・電話</th>
                    <th className="col-product">商品</th>
                    <th className="col-amount">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {grp.orders.map((order) => {
                    const customer = order.customers as { id: string; name: string } | null;
                    const isSelf = customer && order.delivery_name.trim() === customer.name.trim();
                    const timeStr = formatTimeRange(order.delivery_time_start, order.delivery_time_end);
                    const hasTime = order.delivery_time_start || order.delivery_time_end;

                    return (
                      <tr key={order.id}>
                        {/* 時刻 */}
                        <td className="col-time">
                          {hasTime ? (
                            <span className="time-val">{timeStr}</span>
                          ) : (
                            <span className="time-none">時間未定</span>
                          )}
                        </td>

                        {/* 届け先 */}
                        <td className="col-dest">
                          {isSelf ? (
                            <div className="name-main">{customer?.name}</div>
                          ) : (
                            <>
                              <div className="name-main">{order.delivery_name}</div>
                              {customer && (
                                <div className="name-sub">（{customer.name}）</div>
                              )}
                            </>
                          )}
                        </td>

                        {/* 住所・電話 */}
                        <td className="col-contact">
                          {order.delivery_address && (
                            <div className="contact-addr">{order.delivery_address}</div>
                          )}
                          {order.delivery_phone && (
                            <div className="contact-tel">☎ {order.delivery_phone}</div>
                          )}
                          {!order.delivery_address && !order.delivery_phone && (
                            <span style={{ color: "#9ca3af", fontSize: "7.5pt" }}>—</span>
                          )}
                        </td>

                        {/* 商品 */}
                        <td className="col-product">
                          <span className="product-name">
                            {order.product_name ?? `${order.quantity}点`}
                          </span>
                        </td>

                        {/* 金額 */}
                        <td className="col-amount">
                          {order.total_amount != null && order.total_amount > 0 ? (
                            <span className="amount-val">
                              ¥{order.total_amount.toLocaleString("ja-JP")}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* ─── 合計サマリ ─── */}
          {orders.length > 0 && (() => {
            const totalAmount = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
            const typeCounts = TYPE_CONFIG
              .map((c) => ({ label: c.label, count: orders.filter((o) => (o.order_type ?? "配達") === c.type).length }))
              .filter((x) => x.count > 0);
            return (
              <div className="summary-row">
                {typeCounts.map((tc) => (
                  <div key={tc.label} className="summary-item">
                    <span className="summary-label">{tc.label}</span>
                    <span className="summary-value">{tc.count} 件</span>
                  </div>
                ))}
                <div className="summary-item">
                  <span className="summary-label">合計件数</span>
                  <span className="summary-value">{orders.length} 件</span>
                </div>
                {totalAmount > 0 && (
                  <div className="summary-item">
                    <span className="summary-label">売上合計（税込）</span>
                    <span className="summary-value">¥{totalAmount.toLocaleString("ja-JP")}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── フッター ─── */}
          <div className="rpt-footer">
            印刷日時: {new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </div>

        </div>
      </div>
    </>
  );
}
