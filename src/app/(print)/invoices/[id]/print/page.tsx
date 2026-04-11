import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoicePrintBar } from "@/components/admin/InvoicePrintBar";

// ── 店舗情報 ────────────────────────────────────────────
const SHOP_NAME    = "花長";
const SHOP_ADDRESS = "東京都港区南青山 7-12-9";
const SHOP_TEL     = "03-3407-0211";
const SHOP_EMAIL   = "aoyamahanacho@nifty.com";

// ── 振込先情報 ──────────────────────────────────────────
const BANK_NAME    = "三井住友銀行";
const BANK_BRANCH  = "青山支店";
const BANK_TYPE    = "普通";
const BANK_NUMBER  = "1234567";
const BANK_HOLDER  = "カ）ハナチョウ";
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

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:  "下書き",
  issued: "発行済み",
  sent:   "送付済み",
  paid:   "入金済み",
};

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
    .select("*, customers(id, name, phone, email, address)")
    .eq("id", id)
    .single();
  if (!invoice) notFound();

  const inv = invoice as {
    id: string; invoice_number: string; invoice_type: string;
    target_year_month: string | null; status: InvoiceStatus;
    subtotal: number; tax_amount: number; total_amount: number;
    issued_at: string | null; sent_at: string | null; due_date: string | null;
    remarks: string | null; created_at: string;
    customers: { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null;
  };

  const { data: items } = await supabase
    .from("invoice_items" as never)
    .select("id, description, quantity, unit_price, tax_rate, order_id")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  type ItemRow = { id: string; description: string; quantity: number; unit_price: number; tax_rate: number; order_id: string | null };
  const invoiceItems = (items ?? []) as unknown as ItemRow[];

  const issuedDateFmt = inv.issued_at
    ? new Date(inv.issued_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : new Date(inv.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  const dueDateFmt = inv.due_date
    ? new Date(inv.due_date).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid";

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
          {/* ── ヘッダー ── */}
          <div style={{ marginBottom: "12pt" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              {/* 左: ロゴ + 店舗情報 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3pt" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt={SHOP_NAME}
                  style={{ height: "36pt", width: "auto", objectFit: "contain", objectPosition: "left center" }}
                />
                <div style={{ fontSize: "7pt", color: GRAY3, lineHeight: 1.7, marginTop: "2pt" }}>
                  <div>{SHOP_ADDRESS}</div>
                  <div>TEL {SHOP_TEL}　{SHOP_EMAIL}</div>
                </div>
              </div>

              {/* 右: タイトル */}
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: "24pt",
                  fontWeight: "700",
                  letterSpacing: "0.35em",
                  color: GRAY1,
                  lineHeight: 1,
                  marginBottom: "6pt",
                }}>
                  請　求　書
                </div>
                <div style={{ fontSize: "7.5pt", color: GRAY3, lineHeight: 1.9 }}>
                  <div>発行日：{issuedDateFmt}</div>
                  <div style={{ letterSpacing: "0.02em" }}>No. {inv.invoice_number}</div>
                  <div style={{ marginTop: "2pt" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "1.5pt 7pt",
                      borderRadius: "99pt",
                      fontSize: "7pt",
                      fontWeight: "600",
                      background:
                        inv.status === "paid"   ? "#d1fae5" :
                        inv.status === "sent"   ? "#fef3c7" :
                        inv.status === "issued" ? "#dbeafe" : "#f3f4f6",
                      color:
                        inv.status === "paid"   ? "#065f46" :
                        inv.status === "sent"   ? "#92400e" :
                        inv.status === "issued" ? "#1e40af" : "#374151",
                      border: "1px solid",
                      borderColor:
                        inv.status === "paid"   ? "#6ee7b7" :
                        inv.status === "sent"   ? "#fcd34d" :
                        inv.status === "issued" ? "#93c5fd" : "#d1d5db",
                    }}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 区切り線 */}
            <div style={{ marginTop: "8pt", borderTop: `2px solid ${GOLD}` }} />
            <div style={{ marginTop: "1.5pt", borderTop: `0.5px solid ${RULE}` }} />
          </div>

          {/* ── 請求先 + 請求情報 ── */}
          <div style={{ display: "flex", gap: "12pt", marginBottom: "14pt" }}>
            {/* 請求先 */}
            <div style={{
              flex: "1",
              border: `1px solid ${RULE}`,
              borderRadius: "3pt",
              padding: "10pt 14pt",
              backgroundColor: GOLD_L,
            }}>
              <div style={{ fontSize: "6.5pt", fontWeight: "700", color: GOLD, letterSpacing: "0.12em", marginBottom: "6pt", textTransform: "uppercase" }}>
                請求先
              </div>
              <div style={{ fontSize: "15pt", fontWeight: "700", lineHeight: 1.3, marginBottom: "5pt" }}>
                {inv.customers?.name ?? "—"}
                <span style={{ fontSize: "10pt", fontWeight: "500", marginLeft: "3pt" }}>様</span>
              </div>
              {inv.customers?.address && (
                <div style={{ fontSize: "8pt", color: GRAY2, lineHeight: 1.7 }}>{inv.customers.address}</div>
              )}
              {inv.customers?.phone && (
                <div style={{ fontSize: "8pt", color: GRAY2, lineHeight: 1.7 }}>TEL {inv.customers.phone}</div>
              )}
              {inv.customers?.email && (
                <div style={{ fontSize: "8pt", color: GRAY2, lineHeight: 1.7 }}>{inv.customers.email}</div>
              )}
            </div>

            {/* 請求情報 */}
            <div style={{
              width: "140pt",
              border: `1px solid #ddd8ce`,
              borderRadius: "3pt",
              padding: "10pt 14pt",
              backgroundColor: "#fdfcfa",
              flexShrink: 0,
            }}>
              <div style={{ fontSize: "6.5pt", fontWeight: "700", color: GOLD, letterSpacing: "0.12em", marginBottom: "8pt", textTransform: "uppercase" }}>
                請求情報
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
                <tbody>
                  {dueDateFmt && (
                    <tr>
                      <td style={{ color: GRAY3, paddingBottom: "4pt", width: "48pt", verticalAlign: "top" }}>支払期限</td>
                      <td style={{
                        fontWeight: "600",
                        paddingBottom: "4pt",
                        color: isOverdue ? "#dc2626" : GRAY1,
                        verticalAlign: "top",
                      }}>
                        {dueDateFmt}
                        {isOverdue && (
                          <span style={{ fontSize: "6.5pt", marginLeft: "3pt", color: "#dc2626" }}>（期限超過）</span>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ color: GRAY3, paddingBottom: "4pt", verticalAlign: "top" }}>種別</td>
                    <td style={{ paddingBottom: "4pt", verticalAlign: "top" }}>
                      {inv.invoice_type === "monthly" ? "月別まとめ" : "個別"}
                      {inv.target_year_month && (
                        <span style={{ fontSize: "7pt", color: GRAY3, marginLeft: "3pt" }}>
                          （{inv.target_year_month}）
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 合計金額ハイライト */}
              <div style={{
                marginTop: "8pt",
                paddingTop: "8pt",
                borderTop: `1px solid ${RULE}`,
                textAlign: "center",
              }}>
                <div style={{ fontSize: "7pt", color: GRAY3, marginBottom: "3pt", letterSpacing: "0.05em" }}>
                  ご請求金額
                </div>
                <div style={{ fontSize: "17pt", fontWeight: "700", color: GOLD, letterSpacing: "0.02em" }}>
                  ¥{inv.total_amount.toLocaleString("ja-JP")}
                </div>
                <div style={{ fontSize: "7pt", color: GRAY3, marginTop: "2pt" }}>（税込）</div>
              </div>
            </div>
          </div>

          {/* ── 明細テーブル ── */}
          <div style={{ marginBottom: "14pt" }}>
            <div style={{ fontSize: "8pt", fontWeight: "700", color: GOLD, letterSpacing: "0.1em", marginBottom: "6pt" }}>
              明　細
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
              <thead>
                <tr>
                  {(["品名・内容", "数量", "単価（税抜）", "税率", "金額（税込）"] as const).map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 ? "left" : "right",
                        padding: "5pt 8pt",
                        fontWeight: "700",
                        fontSize: "7.5pt",
                        letterSpacing: "0.04em",
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
                {invoiceItems.map((item, idx) => {
                  const excl = item.quantity * item.unit_price;
                  const tax  = Math.round(excl * item.tax_rate / 100);
                  return (
                    <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? BG_ROW : "white" }}>
                      <td style={{ padding: "5pt 8pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600" }}>
                        {item.description}
                      </td>
                      <td style={{ textAlign: "right", padding: "5pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                        {item.quantity}
                      </td>
                      <td style={{ textAlign: "right", padding: "5pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                        ¥{item.unit_price.toLocaleString("ja-JP")}
                      </td>
                      <td style={{ textAlign: "right", padding: "5pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>
                        {item.tax_rate}%
                      </td>
                      <td style={{ textAlign: "right", padding: "5pt 8pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600", whiteSpace: "nowrap" }}>
                        ¥{(excl + tax).toLocaleString("ja-JP")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 合計 */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8pt" }}>
              <div style={{ minWidth: "200pt", fontSize: "8.5pt" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5pt 8pt", color: GRAY3 }}>
                  <span>小計（税抜）</span>
                  <span>¥{inv.subtotal.toLocaleString("ja-JP")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5pt 8pt", color: GRAY3 }}>
                  <span>消費税（10%）</span>
                  <span>¥{inv.tax_amount.toLocaleString("ja-JP")}</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "6pt 8pt",
                  fontWeight: "700", fontSize: "12pt",
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

          {/* ── 振込先 ── */}
          <div style={{
            border: `1px solid #ddd8ce`,
            borderRadius: "3pt",
            padding: "10pt 14pt",
            backgroundColor: "#fdfcfa",
            marginBottom: "12pt",
          }}>
            <div style={{ fontSize: "7pt", fontWeight: "700", color: GOLD, letterSpacing: "0.1em", marginBottom: "8pt" }}>
              お振込先
            </div>
            <div style={{ display: "flex", gap: "20pt", flexWrap: "wrap", fontSize: "8.5pt", color: GRAY2 }}>
              <div>
                <span style={{ fontSize: "7pt", color: GRAY3, display: "block", marginBottom: "2pt" }}>銀行名</span>
                <span style={{ fontWeight: "600" }}>{BANK_NAME}　{BANK_BRANCH}</span>
              </div>
              <div>
                <span style={{ fontSize: "7pt", color: GRAY3, display: "block", marginBottom: "2pt" }}>口座種別</span>
                <span style={{ fontWeight: "600" }}>{BANK_TYPE}</span>
              </div>
              <div>
                <span style={{ fontSize: "7pt", color: GRAY3, display: "block", marginBottom: "2pt" }}>口座番号</span>
                <span style={{ fontWeight: "600" }}>{BANK_NUMBER}</span>
              </div>
              <div>
                <span style={{ fontSize: "7pt", color: GRAY3, display: "block", marginBottom: "2pt" }}>口座名義</span>
                <span style={{ fontWeight: "600" }}>{BANK_HOLDER}</span>
              </div>
            </div>
            {dueDateFmt && (
              <div style={{ marginTop: "8pt", fontSize: "7.5pt", color: GRAY3 }}>
                ※ お支払期限：<span style={{ fontWeight: "600", color: isOverdue ? "#dc2626" : GRAY2 }}>{dueDateFmt}</span>　までにご入金をお願いいたします。
              </div>
            )}
          </div>

          {/* ── 備考 ── */}
          {inv.remarks && (
            <div style={{
              border: `1px solid #ddd8ce`,
              borderRadius: "3pt",
              padding: "10pt 14pt",
              backgroundColor: "#fdfcfa",
              marginBottom: "12pt",
            }}>
              <div style={{ fontSize: "7pt", fontWeight: "700", color: GOLD, letterSpacing: "0.1em", marginBottom: "6pt" }}>
                備　考
              </div>
              <p style={{ fontSize: "8.5pt", color: GRAY2, lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
                {inv.remarks}
              </p>
            </div>
          )}

          {/* ── フッター ── */}
          <div style={{ marginTop: "auto", paddingTop: "10pt" }}>
            <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "6pt" }} />
            <div style={{
              fontSize: "7pt",
              color: GRAY3,
              textAlign: "center",
              lineHeight: 2,
              fontStyle: "italic",
              letterSpacing: "0.06em",
            }}>
              お花のご注文やご相談など、どうぞいつでもお気軽にお問い合わせくださいませ。
            </div>
            <div style={{ borderTop: `0.5px solid ${RULE}`, marginTop: "6pt" }} />
          </div>
        </div>
      </div>
    </>
  );
}
