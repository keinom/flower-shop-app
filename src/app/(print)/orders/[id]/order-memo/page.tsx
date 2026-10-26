import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintActions } from "./PrintActions";

const INK    = "#111827";
const INK2   = "#374151";
const MUTED  = "#6b7280";
const BORDER = "#d1d5db";
const ACCENT = "#0f766e"; // teal-700

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

  // 発送注文: 発送日 / 締切時刻、配達注文: お届け日 / お届け時間
  const isShipping  = orderType === "発送";
  const dateLabel   = isShipping ? "発送日"   : "お届け日";
  const timeLabel   = isShipping ? "発送締切" : "お届け時間";
  const dateValue   = isShipping
    ? (shippingDate ? formatDate(shippingDate) : "未定")
    : (order.delivery_date ? formatDate(order.delivery_date) : "未定");
  const timeValue   = isShipping
    ? (shippingDeadline ? `${shippingDeadline.slice(0, 5)} まで` : "指定なし")
    : (timeStart || timeEnd
        ? `${timeStart ? timeStart.slice(0, 5) : ""}〜${timeEnd ? timeEnd.slice(0, 5) : ""}`
        : "指定なし");

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
            color: INK,
            display: "flex",
            flexDirection: "column",
            gap: "6pt",
          }}
        >
          {/* ─── ① ご注文主 / 宛名 ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6pt" }}>
            <Card label="ご注文主">
              <BigText size={20}>{customer?.name ?? "—"}</BigText>
            </Card>
            <Card label="宛名（お届け先）" emphasis>
              <BigText size={20} preLine>{order.delivery_name ?? "—"}</BigText>
            </Card>
          </div>

          {/* ─── ② 配達日 / 時間 ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6pt" }}>
            <Card label={dateLabel}>
              <BigText size={18}>{dateValue}</BigText>
            </Card>
            <Card label={timeLabel}>
              <BigText size={18}>{timeValue}</BigText>
            </Card>
          </div>

          {/* ─── ③ 用途 ─── */}
          <Card label="用途">
            <BigText size={20}>{order.purpose ?? "—"}</BigText>
          </Card>

          {/* ─── ④ 商品 ／ 数量 ─── */}
          <Card label="商品 ／ 数量" expand>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "5pt",
              paddingTop: "2pt",
            }}>
              {displayItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    columnGap: "16pt",
                    alignItems: "baseline",
                    padding: "3pt 0",
                    borderBottom: idx < displayItems.length - 1 ? `0.5px dashed ${BORDER}` : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "18pt", fontWeight: 700, lineHeight: 1.25 }}>
                      {item.product_name}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: "9pt", color: MUTED, marginTop: "1pt", lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: "18pt",
                    fontWeight: 700,
                    color: ACCENT,
                    whiteSpace: "nowrap",
                  }}>
                    × {item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────
// パーツ
// ────────────────────────────────────────────────────

function Card({
  label,
  emphasis = false,
  expand = false,
  children,
}: {
  label: string;
  emphasis?: boolean;
  expand?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderTop: emphasis ? `2pt solid ${ACCENT}` : `1px solid ${BORDER}`,
      borderRadius: "2pt",
      padding: "5pt 9pt 6pt",
      backgroundColor: "white",
      flex: expand ? 1 : undefined,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        fontSize: "8pt",
        fontWeight: 700,
        color: emphasis ? ACCENT : MUTED,
        letterSpacing: "0.15em",
        marginBottom: "3pt",
      }}>
        {label}
      </div>
      <div style={{ flex: expand ? 1 : undefined }}>{children}</div>
    </div>
  );
}

function BigText({
  size,
  preLine = false,
  children,
}: {
  size: number;
  preLine?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      fontSize: `${size}pt`,
      fontWeight: 700,
      lineHeight: 1.25,
      color: INK2,
      whiteSpace: preLine ? "pre-line" : "normal",
    }}>
      {children}
    </div>
  );
}
