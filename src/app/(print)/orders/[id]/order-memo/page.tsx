import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintActions } from "./PrintActions";

const INK    = "#1a1a1a";
const MUTED  = "#6b7280";
const BORDER = "#d1d5db";

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
    .select("*, customers(name)")
    .eq("id", id)
    .single();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, description, quantity")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = order.customers as { name: string } | null;

  const orderType        = (order as { order_type?: string }).order_type ?? "配達";
  const timeStart        = (order as { delivery_time_start?: string | null }).delivery_time_start;
  const timeEnd          = (order as { delivery_time_end?: string | null }).delivery_time_end;
  const shippingDate     = (order as { shipping_date?: string | null }).shipping_date;
  const shippingDeadline = (order as { shipping_deadline?: string | null }).shipping_deadline;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric", month: "long", day: "numeric", weekday: "short",
    });

  const dateLine = orderType === "発送"
    ? (shippingDate ? formatDate(shippingDate) : "発送日 未定")
    : (order.delivery_date ? formatDate(order.delivery_date) : "日付 未定");

  const timeLine = orderType === "発送"
    ? (shippingDeadline ? `${shippingDeadline.slice(0, 5)} 締切` : null)
    : (timeStart || timeEnd
        ? `${timeStart ? timeStart.slice(0, 5) : ""}〜${timeEnd ? timeEnd.slice(0, 5) : ""}`
        : null);

  // 商品: order_items が空なら orders 自体の product_name/quantity から組み立て
  const displayItems = (items && items.length > 0)
    ? items.map((i) => ({
        product_name: i.product_name || "（商品名未入力）",
        description: (i as { description?: string | null }).description ?? null,
        quantity: i.quantity,
      }))
    : [{
        product_name: order.product_name ?? "（商品名未入力）",
        description: null,
        quantity: order.quantity,
      }];

  return (
    <>
      <PrintActions />

      <style>{`
        @media print {
          @page { size: A5 landscape; margin: 0; }
          html, body { margin: 0; padding: 0; background: white !important; overflow: hidden; }
          .om-page {
            margin: 0 !important;
            padding: 10mm 14mm !important;
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
            padding: 10mm 14mm;
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
            color: INK,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ─── ご注文者 / 宛名 ─── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16pt",
            paddingBottom: "8pt",
            borderBottom: `1px solid ${BORDER}`,
          }}>
            <NameBlock label="ご注文者" name={customer?.name ?? "—"} />
            <NameBlock label="宛名" name={order.delivery_name ?? "—"} />
          </div>

          {/* ─── 内容: 用途・商品 ─── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "10pt 0" }}>
            {order.purpose && (
              <div style={{ textAlign: "center", marginBottom: "12pt" }}>
                <div style={{ fontSize: "9pt", color: MUTED, letterSpacing: "0.2em", marginBottom: "3pt" }}>
                  用途
                </div>
                <div style={{ fontSize: "28pt", fontWeight: 800, letterSpacing: "0.05em" }}>
                  {order.purpose}
                </div>
              </div>
            )}

            <div>
              <div style={{
                fontSize: "9pt",
                color: MUTED,
                letterSpacing: "0.2em",
                textAlign: "center",
                marginBottom: "6pt",
              }}>
                商品 ／ 数量
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5pt" }}>
                {displayItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "center",
                      gap: "18pt",
                      fontSize: "22pt",
                      fontWeight: 700,
                      lineHeight: 1.25,
                    }}
                  >
                    <span style={{ whiteSpace: "pre-line" }}>{item.product_name}</span>
                    <span style={{ color: MUTED, fontSize: "14pt", fontWeight: 500 }}>×</span>
                    <span>{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── 配達日時 ─── */}
          <div style={{
            paddingTop: "8pt",
            borderTop: `1px solid ${BORDER}`,
            textAlign: "center",
          }}>
            <div style={{
              fontSize: "20pt",
              fontWeight: 700,
              letterSpacing: "0.04em",
              lineHeight: 1.3,
            }}>
              {dateLine}
              {timeLine && (
                <span style={{ marginLeft: "16pt", fontWeight: 600 }}>{timeLine}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function NameBlock({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <div style={{ fontSize: "9pt", color: MUTED, letterSpacing: "0.2em", marginBottom: "3pt" }}>
        {label}
      </div>
      <div style={{
        fontSize: "18pt",
        fontWeight: 700,
        lineHeight: 1.25,
        whiteSpace: "pre-line",
      }}>
        {name}
      </div>
    </div>
  );
}
