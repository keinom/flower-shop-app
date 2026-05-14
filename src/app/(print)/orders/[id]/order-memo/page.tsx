import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatJstDate } from "@/lib/date";
import { PrintActions } from "./PrintActions";

// デザイントークン
const INK     = "#1a1a1a";
const INK2    = "#3a3a3a";
const MUTED   = "#6b7280";
const BORDER  = "#d1d5db";
const BG_SOFT = "#f9fafb";
const ACCENT  = "#0f766e"; // teal-700 — 内部用らしさを示す

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderMemoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(id, name, phone, email, postal_code, address)")
    .eq("id", id)
    .single();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, description, quantity, unit_price, tax_rate")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = order.customers as {
    id: string; name: string;
    phone: string | null; email: string | null;
    postal_code?: string | null; address: string | null;
  } | null;

  const orderType   = (order as { order_type?: string }).order_type ?? "配達";
  const deliveryPostalCode = (order as { delivery_postal_code?: string | null }).delivery_postal_code;
  const deliveryPhone      = (order as { delivery_phone?: string | null }).delivery_phone;
  const deliveryEmail      = (order as { delivery_email?: string | null }).delivery_email;
  const timeStart          = (order as { delivery_time_start?: string | null }).delivery_time_start;
  const timeEnd            = (order as { delivery_time_end?: string | null }).delivery_time_end;
  const shippingDate       = (order as { shipping_date?: string | null }).shipping_date;
  const shippingDeadline   = (order as { shipping_deadline?: string | null }).shipping_deadline;

  const deliveryDateFmt = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      })
    : "未定";
  const shippingDateFmt = shippingDate
    ? new Date(shippingDate).toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      })
    : null;
  const deliveryTime = timeStart || timeEnd
    ? `${timeStart ? timeStart.slice(0, 5) : ""}〜${timeEnd ? timeEnd.slice(0, 5) : ""}`
    : null;

  const shortId = id.slice(0, 8);

  return (
    <>
      <PrintActions />

      <style>{`
        @media print {
          @page { size: A5 landscape; margin: 0; }
          html, body { margin: 0; padding: 0; background: white !important; overflow: hidden; }
          .om-page {
            margin: 0 !important;
            padding: 8mm 10mm !important;
            box-shadow: none !important;
            width: 210mm !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .om-page + * { display: none !important; }
        }
        @media screen {
          body { background: #e5e7eb; }
          .om-wrapper {
            padding-top: 60px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-bottom: 40px;
          }
          .om-page {
            background: white;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18);
            padding: 8mm 10mm;
          }
        }
      `}</style>

      <div className="om-wrapper">
        <div
          className="om-page"
          style={{
            width: "210mm",
            minHeight: "148mm",
            boxSizing: "border-box",
            fontFamily: "'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif",
            fontSize: "9pt",
            color: INK,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ─── ヘッダー ─── */}
          <div style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingBottom: "5pt",
            borderBottom: `2px solid ${INK}`,
            marginBottom: "8pt",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10pt" }}>
              <span style={{ fontSize: "16pt", fontWeight: 800, letterSpacing: "0.15em" }}>
                注文メモ
              </span>
              <span style={{
                fontSize: "7pt",
                color: "#fff",
                background: ACCENT,
                padding: "1.5pt 5pt",
                borderRadius: "2pt",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}>
                内部用
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8pt", fontSize: "8pt", color: MUTED }}>
              <span>注文ID: <span style={{ fontFamily: "monospace", color: INK }}>{shortId}</span></span>
              <span>|</span>
              <span>注文日: {formatJstDate(order.created_at)}</span>
              <span>|</span>
              <Tag>{orderType}</Tag>
              <Tag>{order.status}</Tag>
            </div>
          </div>

          {/* ─── 上段: 注文元 + お届け先 ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8pt", marginBottom: "8pt" }}>
            <Section title="注文元（お客様）">
              <Field label="顧客名" value={customer?.name ?? "—"} bold large />
              <FieldInline label="電話" value={customer?.phone ?? "—"} />
              <FieldInline label="メール" value={customer?.email ?? "—"} />
              {(customer?.postal_code || customer?.address) && (
                <FieldInline
                  label="住所"
                  value={`${customer.postal_code ? `〒${customer.postal_code} ` : ""}${customer.address ?? ""}`}
                />
              )}
            </Section>

            <Section title="お届け先" accent>
              <Field
                label="お届け先名"
                value={order.delivery_name}
                bold
                large
                preLine
              />
              <FieldInline
                label="住所"
                value={`${deliveryPostalCode ? `〒${deliveryPostalCode} ` : ""}${order.delivery_address ?? "—"}`}
              />
              <FieldInline label="電話" value={deliveryPhone ?? "—"} />
              {deliveryEmail && <FieldInline label="メール" value={deliveryEmail} />}
            </Section>
          </div>

          {/* ─── 中段: 日時・用途 ─── */}
          <div style={{
            border: `1px solid ${BORDER}`,
            borderLeft: `3pt solid ${ACCENT}`,
            borderRadius: "2pt",
            padding: "5pt 9pt",
            marginBottom: "8pt",
            backgroundColor: BG_SOFT,
            display: "grid",
            gridTemplateColumns: orderType === "発送" ? "1.4fr 1fr 1fr" : "1.4fr 1fr 1fr",
            gap: "10pt",
            alignItems: "baseline",
          }}>
            {orderType === "発送" ? (
              <>
                <DateBlock label="発送日" value={shippingDateFmt ?? "未定"} primary />
                <DateBlock label="発送締切" value={shippingDeadline ? `${shippingDeadline.slice(0, 5)} まで` : "—"} />
                <DateBlock label="到着希望日" value={deliveryDateFmt} />
              </>
            ) : (
              <>
                <DateBlock label="お届け希望日" value={deliveryDateFmt} primary />
                <DateBlock label="希望時間帯" value={deliveryTime ?? "指定なし"} />
                <DateBlock label="用途" value={order.purpose ?? "—"} />
              </>
            )}
          </div>

          {/* ─── 商品明細 ─── */}
          <div style={{ marginBottom: "8pt" }}>
            <SectionLabel>商品明細{orderType !== "発送" ? "" : " ／ 用途: " + (order.purpose ?? "—")}</SectionLabel>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", marginTop: "3pt" }}>
              <thead>
                <tr>
                  <Th>商品名 / 説明</Th>
                  <Th align="right" width="36pt">数量</Th>
                </tr>
              </thead>
              <tbody>
                {items && items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? BG_SOFT : "white" }}>
                      <Td>
                        <div style={{ fontWeight: 600 }}>{item.product_name || "（商品名未入力）"}</div>
                        {(item as { description?: string | null }).description && (
                          <div style={{ fontSize: "7.5pt", color: MUTED, marginTop: "1pt" }}>
                            {(item as { description: string }).description}
                          </div>
                        )}
                      </Td>
                      <Td align="right" nowrap>{item.quantity}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td>{order.product_name ?? "—"}</Td>
                    <Td align="right" nowrap>{order.quantity}</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ─── メッセージカード ─── */}
          {order.message_card && (
            <div style={{ marginBottom: "6pt" }}>
              <SectionLabel>メッセージカード</SectionLabel>
              <div style={{
                marginTop: "3pt",
                padding: "5pt 8pt",
                border: `1px dashed ${BORDER}`,
                borderRadius: "2pt",
                fontSize: "9pt",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                color: INK2,
              }}>
                {order.message_card}
              </div>
            </div>
          )}

          {/* ─── 備考 ─── */}
          {order.remarks && (
            <div style={{ marginBottom: "6pt" }}>
              <SectionLabel>備考・ご要望</SectionLabel>
              <div style={{
                marginTop: "3pt",
                padding: "5pt 8pt",
                background: "#fffbeb",
                borderLeft: `3pt solid #f59e0b`,
                fontSize: "9pt",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                color: INK2,
              }}>
                {order.remarks}
              </div>
            </div>
          )}

          {/* ─── フッター ─── */}
          <div style={{
            marginTop: "auto",
            paddingTop: "5pt",
            borderTop: `0.5px solid ${BORDER}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: "7pt",
            color: MUTED,
          }}>
            <span>※ このメモは社内確認用です。お客様への配布や納品書としての使用は想定していません。</span>
            <span>注文ID: {id}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────
// パーツ
// ────────────────────────────────────────────────────

function Section({ title, accent = false, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderTop: accent ? `2pt solid ${ACCENT}` : `1px solid ${BORDER}`,
      borderRadius: "2pt",
      padding: "5pt 9pt",
      backgroundColor: "white",
    }}>
      <div style={{
        fontSize: "6.5pt",
        fontWeight: 700,
        color: accent ? ACCENT : MUTED,
        letterSpacing: "0.12em",
        marginBottom: "3pt",
        textTransform: "uppercase",
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2pt" }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "6.5pt",
      fontWeight: 700,
      color: MUTED,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
    }}>
      {children}
    </div>
  );
}

function Field({
  label, value, bold = false, large = false, preLine = false,
}: { label: string; value: string; bold?: boolean; large?: boolean; preLine?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "6.5pt", color: MUTED, marginBottom: "1pt" }}>{label}</div>
      <div style={{
        fontSize: large ? "11pt" : "9pt",
        fontWeight: bold ? 700 : 400,
        lineHeight: 1.3,
        whiteSpace: preLine ? "pre-line" : "normal",
      }}>
        {value}
      </div>
    </div>
  );
}

function FieldInline({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "6pt", fontSize: "8.5pt", lineHeight: 1.5 }}>
      <span style={{ color: MUTED, minWidth: "30pt" }}>{label}</span>
      <span style={{ color: INK2, flex: 1 }}>{value}</span>
    </div>
  );
}

function DateBlock({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "6.5pt", color: MUTED, letterSpacing: "0.08em", marginBottom: "1pt" }}>{label}</div>
      <div style={{
        fontSize: primary ? "11pt" : "9.5pt",
        fontWeight: primary ? 700 : 600,
        color: primary ? ACCENT : INK,
        lineHeight: 1.2,
      }}>
        {value}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: "7pt",
      fontWeight: 700,
      color: INK,
      background: BG_SOFT,
      border: `1px solid ${BORDER}`,
      padding: "1pt 5pt",
      borderRadius: "2pt",
    }}>
      {children}
    </span>
  );
}

function Th({ children, align = "left", width }: { children: React.ReactNode; align?: "left" | "right"; width?: string }) {
  return (
    <th style={{
      textAlign: align,
      padding: "3pt 6pt",
      fontSize: "7pt",
      fontWeight: 700,
      color: MUTED,
      letterSpacing: "0.08em",
      borderTop: `1.5px solid ${INK}`,
      borderBottom: `0.5px solid ${BORDER}`,
      backgroundColor: BG_SOFT,
      width,
      whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", nowrap = false }: { children: React.ReactNode; align?: "left" | "right"; nowrap?: boolean }) {
  return (
    <td style={{
      textAlign: align,
      padding: "3.5pt 6pt",
      fontSize: "9pt",
      borderBottom: `0.5px solid ${BORDER}`,
      whiteSpace: nowrap ? "nowrap" : "normal",
      verticalAlign: "top",
    }}>
      {children}
    </td>
  );
}
