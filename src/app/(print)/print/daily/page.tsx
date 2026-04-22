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

// 種別の表示順（白黒印刷用：色なし）
const TYPE_CONFIG: { type: string; label: string }[] = [
  { type: "生け込み", label: "生け込み" },
  { type: "配達",    label: "配 達"   },
  { type: "来店",    label: "来 店"   },
  { type: "発送",    label: "発 送"   },
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
  const groups: { type: string; label: string; orders: OrderRow[] }[] = [];
  for (const cfg of TYPE_CONFIG) {
    const group = orders.filter((o) => (o.order_type ?? "配達") === cfg.type);
    if (group.length > 0) groups.push({ ...cfg, orders: group });
  }
  // 未知の種別を末尾に追加
  const knownTypes = new Set(TYPE_ORDER);
  const otherOrders = orders.filter((o) => !knownTypes.has(o.order_type ?? "配達") && o.order_type !== null);
  if (otherOrders.length > 0) {
    groups.push({ type: "その他", label: "その他", orders: otherOrders });
  }

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const FONT = '"Hiragino Sans", "Yu Gothic", "Meiryo", "MS Gothic", sans-serif';

  // 種別別件数（サマリ用）
  const typeCounts = TYPE_CONFIG
    .map((c) => ({ label: c.label.replace(/\s/g, ""), count: orders.filter((o) => (o.order_type ?? "配達") === c.type).length }))
    .filter((x) => x.count > 0);

  return (
    <>
      <PrintBar title={`📋 日報 ${dateLabel}`} />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            background: white !important;
            /* 白黒印刷でもグレー背景が出るよう exact にする */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper { padding: 0 !important; }
        }

        @media screen {
          body { background: #9ca3af !important; padding-top: 52px; }
          .print-wrapper {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px 16px 48px;
          }
          .print-page {
            background: white;
            box-shadow: 0 4px 24px rgba(0,0,0,0.25);
            min-height: 297mm;
            padding: 12mm;
          }
        }

        body { font-family: ${FONT}; color: #000; }

        /* ── ページヘッダー ── */
        .rpt-header {
          border-bottom: 2px solid #000;
          padding-bottom: 4pt;
          margin-bottom: 7pt;
          display: flex;
          align-items: baseline;
          gap: 12pt;
        }
        .rpt-title { font-size: 14pt; font-weight: bold; letter-spacing: 0.15em; }
        .rpt-date  { font-size: 11pt; font-weight: bold; flex: 1; }
        .rpt-count { font-size: 9pt; white-space: nowrap; }

        /* ── 種別セクション ── */
        .section { margin-bottom: 9pt; }
        /* page-break はテーブルが長い場合に備えて section 単位で avoid */
        .section { break-inside: avoid; page-break-inside: avoid; }

        /* 黒地・白文字のセクションヘッダー（白黒印刷で種別が明確に分かる） */
        .section-head {
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 3pt 6pt;
          margin-bottom: 0;
        }
        .section-head-label {
          font-size: 10pt;
          font-weight: bold;
          letter-spacing: 0.2em;
        }
        .section-head-count {
          font-size: 9pt;
          font-weight: normal;
        }

        /* ── 注文テーブル ── */
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
        }
        .orders-table th {
          background: #d4d4d4;   /* 白黒でもグレーとして印刷される */
          border: 0.75pt solid #000;
          padding: 2.5pt 4pt;
          text-align: left;
          font-size: 8pt;
          font-weight: bold;
          white-space: nowrap;
        }
        .orders-table td {
          border: 0.75pt solid #000;
          padding: 3pt 4pt;
          vertical-align: top;
          line-height: 1.5;
        }
        /* 奇数行：白 / 偶数行：薄いグレー（白黒印刷で交互に読みやすく） */
        .orders-table tbody tr:nth-child(even) td {
          background: #f0f0f0;
        }

        /* 列幅 */
        .col-time    { width: 13%; white-space: nowrap; }
        .col-dest    { width: 22%; }
        .col-contact { width: 29%; }
        .col-product { width: 24%; }
        .col-amount  { width: 12%; text-align: right; white-space: nowrap; }

        /* セル内スタイル */
        .time-val  { font-size: 9pt; font-weight: bold; }
        .time-none { font-size: 8pt; color: #666; }
        .name-main { font-size: 9pt; font-weight: bold; }
        .name-sub  { font-size: 7.5pt; color: #555; margin-top: 1pt; }
        .addr-line { font-size: 7.5pt; }
        .tel-line  { font-size: 7.5pt; margin-top: 1pt; }
        .amount-val { font-size: 9pt; font-weight: bold; }
        .amount-tax { font-size: 6.5pt; font-weight: normal; display: block; color: #555; }

        /* ── サマリ行（件数のみ、金額なし） ── */
        .summary {
          margin-top: 8pt;
          border-top: 1.5pt solid #000;
          padding-top: 4pt;
          display: flex;
          gap: 16pt;
          justify-content: flex-end;
          font-size: 9pt;
        }
        .summary-item { display: flex; flex-direction: column; align-items: flex-end; gap: 1pt; }
        .summary-label { font-size: 7pt; color: #555; }
        .summary-value { font-size: 11pt; font-weight: bold; }

        /* ── フッター ── */
        .rpt-footer {
          margin-top: 8pt;
          border-top: 0.5pt solid #aaa;
          padding-top: 3pt;
          font-size: 7pt;
          color: #777;
          text-align: right;
        }
      `}</style>

      <div className="print-wrapper">
        <div className="print-page">

          {/* ── ページヘッダー ── */}
          <div className="rpt-header">
            <span className="rpt-title">日　報</span>
            <span className="rpt-date">{dateLabel}</span>
            <span className="rpt-count">合計 {orders.length} 件</span>
          </div>

          {/* ── 注文なし ── */}
          {orders.length === 0 && (
            <p style={{ textAlign: "center", padding: "40pt 0", color: "#666", fontSize: "11pt" }}>
              この日の注文はありません
            </p>
          )}

          {/* ── 種別グループ ── */}
          {groups.map((grp) => (
            <div key={grp.type} className="section">

              {/* 黒帯ヘッダー */}
              <div className="section-head">
                <span className="section-head-label">◆ {grp.label}</span>
                <span className="section-head-count">{grp.orders.length} 件</span>
              </div>

              <table className="orders-table">
                <thead>
                  <tr>
                    <th className="col-time">時刻</th>
                    <th className="col-dest">届け先</th>
                    <th className="col-contact">住所・電話</th>
                    <th className="col-product">商品</th>
                    <th className="col-amount">金額（税込）</th>
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
                          {hasTime
                            ? <span className="time-val">{timeStr}</span>
                            : <span className="time-none">時間未定</span>}
                        </td>

                        {/* 届け先 */}
                        <td className="col-dest">
                          {isSelf ? (
                            <div className="name-main">{customer?.name}</div>
                          ) : (
                            <>
                              <div className="name-main">{order.delivery_name}</div>
                              {customer && (
                                <div className="name-sub">注文元：{customer.name}</div>
                              )}
                            </>
                          )}
                        </td>

                        {/* 住所・電話 */}
                        <td className="col-contact">
                          {order.delivery_address && (
                            <div className="addr-line">{order.delivery_address}</div>
                          )}
                          {order.delivery_phone && (
                            <div className="tel-line">☎ {order.delivery_phone}</div>
                          )}
                          {!order.delivery_address && !order.delivery_phone && (
                            <span style={{ color: "#999", fontSize: "7.5pt" }}>—</span>
                          )}
                        </td>

                        {/* 商品 */}
                        <td className="col-product">
                          {order.product_name ?? `${order.quantity}点`}
                        </td>

                        {/* 金額（税込表示） */}
                        <td className="col-amount">
                          {order.total_amount != null && order.total_amount > 0 ? (
                            <>
                              <span className="amount-val">
                                ¥{order.total_amount.toLocaleString("ja-JP")}
                              </span>
                              <span className="amount-tax">税込</span>
                            </>
                          ) : (
                            <span style={{ color: "#999" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* ── サマリ（件数のみ） ── */}
          {orders.length > 0 && (
            <div className="summary">
              {typeCounts.map((tc) => (
                <div key={tc.label} className="summary-item">
                  <span className="summary-label">{tc.label}</span>
                  <span className="summary-value">{tc.count} 件</span>
                </div>
              ))}
              <div className="summary-item">
                <span className="summary-label">合計</span>
                <span className="summary-value">{orders.length} 件</span>
              </div>
            </div>
          )}

          {/* ── フッター ── */}
          <div className="rpt-footer">
            印刷日時：{new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </div>

        </div>
      </div>
    </>
  );
}
