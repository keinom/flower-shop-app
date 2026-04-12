import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoicePrintBar } from "@/components/admin/InvoicePrintBar";

// ── 店舗情報 ────────────────────────────────────────────
const SHOP_NAME    = "花長";
const SHOP_ADDRESS = "東京都港区南青山 7-12-9";
const SHOP_TEL     = "03-3407-0211";
const SHOP_EMAIL   = "info@aoyama-hanacho.com";

// ── 振込先口座 ──────────────────────────────────────────
const BANK_ACCOUNTS = [
  { bank: "みずほ銀行",     branch: "新橋支店",   type: "当座", number: "0009847" },
  { bank: "三井住友銀行",   branch: "青山支店",   type: "当座", number: "0258543" },
  { bank: "三菱UFJ銀行",   branch: "青山支店",   type: "当座", number: "0305686" },
  { bank: "三菱UFJ銀行",   branch: "六本木支店", type: "普通", number: "0011926" },
];
// ────────────────────────────────────────────────────────

// デザイントークン
const GOLD   = "#8B6914";
const GOLD_L = "#f5edda";
const RULE   = "#c9b97a";
const GRAY1  = "#1a1a1a";
const GRAY2  = "#4b4541";
const GRAY3  = "#7c6f60";
const BG_ROW = "#faf8f4";

type InvoiceStatus = "draft" | "issued" | "sent" | "paid";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/customer");

  const { data: invoice } = await supabase
    .from("invoices" as never)
    .select("*, customers(id, name)")
    .eq("id", id)
    .single();
  if (!invoice) notFound();

  const inv = invoice as {
    id: string; invoice_number: string; invoice_type: string;
    target_year_month: string | null; status: InvoiceStatus;
    subtotal: number; tax_amount: number; total_amount: number;
    issued_at: string | null; sent_at: string | null; due_date: string | null;
    remarks: string | null; created_at: string;
    customers: { id: string; name: string } | null;
  };

  const { data: items } = await supabase
    .from("invoice_items" as never)
    .select("id, description, quantity, unit_price, tax_rate, order_id, orders(delivery_date)")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  type ItemRow = {
    id: string; description: string; quantity: number; unit_price: number;
    tax_rate: number; order_id: string | null;
    orders: { delivery_date: string | null } | null;
  };
  const invoiceItems = (items ?? []) as unknown as ItemRow[];

  const issuedDateFmt = inv.issued_at
    ? new Date(inv.issued_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : new Date(inv.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  const dueDateFmt = inv.due_date
    ? new Date(inv.due_date).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid";

  // 対象期間ラベル
  let targetPeriodLabel = "";
  if (inv.invoice_type === "monthly" && inv.target_year_month) {
    const [y, m] = inv.target_year_month.split("-");
    targetPeriodLabel = `${y}年${parseInt(m)}月分`;
  } else if (invoiceItems.length > 0) {
    const firstDelivery = invoiceItems[0].orders?.delivery_date;
    if (firstDelivery) {
      const d = new Date(firstDelivery);
      targetPeriodLabel = d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }) + "のお届け分";
    }
  }

  // 月別請求の場合：お届け日でグループ化
  type OrderGroup = { orderId: string | null; deliveryDate: string | null; items: ItemRow[] };
  const orderGroups: OrderGroup[] = [];
  if (inv.invoice_type === "monthly") {
    const seen = new Map<string, number>();
    for (const item of invoiceItems) {
      const key = item.order_id ?? "__null__";
      if (!seen.has(key)) {
        seen.set(key, orderGroups.length);
        orderGroups.push({ orderId: item.order_id, deliveryDate: item.orders?.delivery_date ?? null, items: [] });
      }
      orderGroups[seen.get(key)!].items.push(item);
    }
  }

  return (
    <>
      {/* 印刷ボタン */}
      <InvoicePrintBar invoiceNumber={inv.invoice_number} invoiceId={id} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;700&display=swap');

        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .inv-page {
            margin: 0 !important;
            padding: 15mm 18mm !important;
            box-shadow: none !important;
            width: 210mm !important;
            min-height: 297mm !important;
          }
        }
        @media screen {
          body { background: #e8e3dc; }
          .inv-wrapper {
            padding-top: 72px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-bottom: 60px;
          }
          .inv-page {
            background: white;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18);
            padding: 15mm 18mm;
          }
        }
      `}</style>

      <div className="inv-wrapper">
        <div
          className="inv-page"
          style={{
            width: "210mm",
            minHeight: "297mm",
            boxSizing: "border-box",
            fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
            fontSize: "9pt",
            color: GRAY1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── ヘッダー：日本標準フォーマット ── */}
          <div style={{ marginBottom: "12pt" }}>

            {/* 1行目: 右に請求日・請求書番号 */}
            <div style={{ textAlign: "right", marginBottom: "5pt" }}>
              <div style={{ fontSize: "8.5pt", color: GRAY3, lineHeight: 1.8 }}>
                <div>請求日：{issuedDateFmt}</div>
                <div>No. {inv.invoice_number}</div>
              </div>
            </div>

            {/* 2行目: タイトル中央 */}
            <div style={{ textAlign: "center", marginBottom: "12pt" }}>
              <div style={{
                fontSize: "16pt",
                fontWeight: "700",
                letterSpacing: "0.5em",
                color: GRAY1,
                lineHeight: 1,
              }}>
                請　求　書
              </div>
            </div>

            {/* 3行目: 左=宛先＋金額 / 右=発行元 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10pt" }}>

              {/* 左: 宛先 → 挨拶文 → ご請求金額 */}
              <div style={{ flex: 1, paddingRight: "20pt" }}>
                {/* 宛先 */}
                <div style={{ fontSize: "15pt", fontWeight: "700", lineHeight: 1.3, marginBottom: "8pt", borderBottom: `1px solid ${RULE}`, paddingBottom: "5pt" }}>
                  {inv.customers?.name ?? "—"}
                  <span style={{ fontSize: "11pt", fontWeight: "500", marginLeft: "4pt" }}>様</span>
                </div>

                {/* 挨拶文 */}
                <div style={{ fontSize: "9pt", color: GRAY2, marginBottom: "10pt" }}>
                  下記の通りご請求申し上げます。
                </div>

                {/* ご請求金額 */}
                <div style={{ marginBottom: "5pt" }}>
                  <div style={{ fontSize: "8.5pt", color: GRAY3, marginBottom: "2pt" }}>ご請求金額</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "5pt", borderBottom: `1.5px solid ${GRAY1}`, paddingBottom: "4pt", marginBottom: "6pt" }}>
                    <span style={{ fontSize: "20pt", fontWeight: "700", color: GOLD, letterSpacing: "0.02em", lineHeight: 1 }}>
                      ¥{inv.total_amount.toLocaleString("ja-JP")}
                    </span>
                    <span style={{ fontSize: "9pt", color: GRAY3 }}>（税込）</span>
                  </div>
                </div>

                {/* 対象期間・支払期限 */}
                <div style={{ fontSize: "9pt", color: GRAY2, lineHeight: 1.9 }}>
                  {targetPeriodLabel && (
                    <div><span style={{ color: GRAY3 }}>対象期間：</span>{targetPeriodLabel}</div>
                  )}
                  {dueDateFmt && (
                    <div>
                      <span style={{ color: GRAY3 }}>お支払期限：</span>
                      <span style={{ fontWeight: "600", color: isOverdue ? "#dc2626" : GRAY1 }}>
                        {dueDateFmt}
                      </span>
                      {isOverdue && (
                        <span style={{ fontSize: "8pt", marginLeft: "4pt", color: "#dc2626" }}>（期限超過）</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 右: 発行元（花長）情報 */}
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: "130pt" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt={SHOP_NAME}
                  style={{ height: "28pt", width: "auto", objectFit: "contain", objectPosition: "right center", display: "block", marginLeft: "auto", marginBottom: "5pt" }}
                />
                <div style={{ fontSize: "8.5pt", color: GRAY3, lineHeight: 1.9 }}>
                  <div>{SHOP_ADDRESS}</div>
                  <div>TEL {SHOP_TEL}</div>
                  <div>{SHOP_EMAIL}</div>
                </div>
              </div>
            </div>

            {/* 区切り線 */}
            <div style={{ borderTop: `2px solid ${GOLD}` }} />
            <div style={{ marginTop: "1.5pt", borderTop: `0.5px solid ${RULE}` }} />
          </div>

          {/* ── 明細テーブル ── */}
          <div style={{ marginBottom: "12pt" }}>
            <div style={{ fontSize: "8.5pt", fontWeight: "700", color: GOLD, letterSpacing: "0.1em", marginBottom: "5pt" }}>
              明　細
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr>
                  {(["品名・内容", "数量", "単価（税抜）", "税率", "金額（税込）"] as const).map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 ? "left" : "right",
                        padding: "4pt 8pt",
                        fontWeight: "700",
                        fontSize: "8.5pt",
                        letterSpacing: "0.03em",
                        color: GOLD,
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1px solid ${RULE}`,
                        backgroundColor: BG_ROW,
                        whiteSpace: "nowrap",
                        width: i === 0 ? "auto" : i === 1 ? "36pt" : i === 2 ? "72pt" : i === 3 ? "36pt" : "80pt",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.invoice_type === "monthly" ? (
                  // 月別：お届け日でグループ化して表示
                  orderGroups.flatMap((group, gi) => [
                    // お届け日ヘッダー行
                    <tr key={`group-${gi}`}>
                      <td
                        colSpan={5}
                        style={{
                          padding: "3.5pt 8pt",
                          backgroundColor: GOLD_L,
                          fontSize: "8.5pt",
                          fontWeight: "700",
                          color: GOLD,
                          borderBottom: `0.5px solid ${RULE}`,
                          borderTop: gi > 0 ? `1px solid ${RULE}` : undefined,
                        }}
                      >
                        {group.deliveryDate
                          ? `お届け日：${new Date(group.deliveryDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`
                          : "お届け日：—"}
                      </td>
                    </tr>,
                    // 各明細行
                    ...group.items.map((item, idx) => {
                      const excl = item.quantity * item.unit_price;
                      const tax  = Math.round(excl * item.tax_rate / 100);
                      return (
                        <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? BG_ROW : "white" }}>
                          <td style={{ padding: "4pt 8pt 4pt 16pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600" }}>
                            {item.description}
                          </td>
                          <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                            {item.quantity}
                          </td>
                          <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                            ¥{item.unit_price.toLocaleString("ja-JP")}
                          </td>
                          <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                            {item.tax_rate}%
                          </td>
                          <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600", whiteSpace: "nowrap" }}>
                            ¥{(excl + tax).toLocaleString("ja-JP")}
                          </td>
                        </tr>
                      );
                    }),
                  ])
                ) : (
                  // 個別：通常表示
                  invoiceItems.map((item, idx) => {
                    const excl = item.quantity * item.unit_price;
                    const tax  = Math.round(excl * item.tax_rate / 100);
                    return (
                      <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? BG_ROW : "white" }}>
                        <td style={{ padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600" }}>
                          {item.description}
                        </td>
                        <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                          {item.quantity}
                        </td>
                        <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                          ¥{item.unit_price.toLocaleString("ja-JP")}
                        </td>
                        <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                          {item.tax_rate}%
                        </td>
                        <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600", whiteSpace: "nowrap" }}>
                          ¥{(excl + tax).toLocaleString("ja-JP")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* 合計 */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6pt" }}>
              <div style={{ minWidth: "200pt", fontSize: "9pt" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 8pt", color: GRAY3 }}>
                  <span>小計（税抜）</span>
                  <span>¥{inv.subtotal.toLocaleString("ja-JP")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 8pt", color: GRAY3 }}>
                  <span>消費税（10%）</span>
                  <span>¥{inv.tax_amount.toLocaleString("ja-JP")}</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "5pt 8pt",
                  fontWeight: "700", fontSize: "11pt",
                  borderTop: `1.5px solid ${RULE}`,
                  marginTop: "3pt",
                  color: GOLD,
                }}>
                  <span>合計（税込）</span>
                  <span>¥{inv.total_amount.toLocaleString("ja-JP")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 備考 ── */}
          {inv.remarks && (
            <div style={{
              border: `1px solid #ddd8ce`,
              borderRadius: "3pt",
              padding: "8pt 12pt",
              backgroundColor: "#fdfcfa",
              marginBottom: "10pt",
            }}>
              <div style={{ fontSize: "8.5pt", fontWeight: "700", color: GOLD, letterSpacing: "0.08em", marginBottom: "5pt" }}>
                備　考
              </div>
              <p style={{ fontSize: "9pt", color: GRAY2, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>
                {inv.remarks}
              </p>
            </div>
          )}

          {/* ── 振込先 ── */}
          <div style={{
            border: `1px solid #ddd8ce`,
            borderRadius: "3pt",
            padding: "8pt 12pt",
            backgroundColor: "#fdfcfa",
            marginBottom: "10pt",
          }}>
            <div style={{ fontSize: "8.5pt", fontWeight: "700", color: GOLD, letterSpacing: "0.08em", marginBottom: "6pt" }}>
              お振込先
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr style={{ backgroundColor: BG_ROW }}>
                  {(["銀行名", "支店名", "種別", "口座番号"] as const).map((h) => (
                    <th key={h} style={{
                      padding: "3pt 8pt",
                      textAlign: "left",
                      fontWeight: "700",
                      fontSize: "8.5pt",
                      color: GRAY3,
                      borderTop: `1px solid #e5dfd3`,
                      borderBottom: `1px solid #e5dfd3`,
                      letterSpacing: "0.03em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BANK_ACCOUNTS.map((acct, i) => (
                  <tr key={i} style={{ borderBottom: i < BANK_ACCOUNTS.length - 1 ? `0.5px solid #ede8de` : undefined }}>
                    <td style={{ padding: "3.5pt 8pt", fontWeight: "600", color: GRAY1, whiteSpace: "nowrap" }}>{acct.bank}</td>
                    <td style={{ padding: "3.5pt 8pt", color: GRAY2, whiteSpace: "nowrap" }}>{acct.branch}</td>
                    <td style={{ padding: "3.5pt 8pt", color: GRAY2, whiteSpace: "nowrap" }}>{acct.type}</td>
                    <td style={{ padding: "3.5pt 8pt", fontWeight: "600", color: GRAY1, letterSpacing: "0.05em" }}>{acct.number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── お支払いのお願い ── */}
          <div style={{ marginTop: "auto", paddingTop: "12pt" }}>
            <div style={{
              fontSize: "8.5pt",
              color: GRAY3,
              lineHeight: 1.9,
              letterSpacing: "0.03em",
            }}>
              平素よりご愛顧を賜り、誠にありがとうございます。
              ご多忙の折、誠に恐れ入りますが、期日までにご入金いただきますようよろしくお願い申し上げます。
            </div>
          </div>

          {/* ── フッター（装飾ライン） ── */}
          <div style={{ paddingTop: "8pt" }}>
            <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "1.5pt" }} />
            <div style={{ borderTop: `0.5px solid ${RULE}` }} />
          </div>
        </div>
      </div>
    </>
  );
}
