import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintActions } from "./PrintActions";

// ── 店舗情報（変更する場合はここを編集） ──────────────────
const SHOP_NAME = "花長";
const SHOP_POSTAL = "";   // 例: "〒100-0001"
const SHOP_ADDRESS = "";  // 例: "東京都千代田区丸の内1-1-1"
const SHOP_TEL = "";      // 例: "03-0000-0000"
// ──────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function DeliveryNotePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const type = sp.type === "gift" ? "gift" : "standard";

  const supabase = await createClient();

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 管理者のみ
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/customer");

  // 注文データ取得
  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(id, name, phone, email, address)")
    .eq("id", id)
    .single();
  if (!order) notFound();

  // 商品明細
  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, description, quantity, unit_price, tax_rate")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = order.customers as {
    id: string; name: string;
    phone: string | null; email: string | null; address: string | null;
  } | null;

  // 金額計算
  const hasItems = items && items.length > 0;
  const totalExcl = hasItems
    ? items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : 0;
  const taxRate = hasItems ? items[0].tax_rate : 10;
  const taxAmt = Math.round(totalExcl * taxRate / 100);
  const totalIncl = totalExcl + taxAmt;

  // 日付フォーマット
  const issuedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const deliveryDateFmt = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString("ja-JP", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      })
    : "未定";

  // 配達時間
  const timeStart = (order as { delivery_time_start?: string | null }).delivery_time_start;
  const timeEnd   = (order as { delivery_time_end?: string | null }).delivery_time_end;
  const deliveryTime = timeStart || timeEnd
    ? `${timeStart ? timeStart.slice(0, 5) : ""}〜${timeEnd ? timeEnd.slice(0, 5) : ""}`
    : null;

  const deliveryPhone = (order as { delivery_phone?: string | null }).delivery_phone;
  const deliveryEmail = (order as { delivery_email?: string | null }).delivery_email;
  const orderNo = id.slice(0, 8).toUpperCase();

  return (
    <>
      {/* 印刷コントロールバー（印刷時は非表示） */}
      <PrintActions orderId={id} currentType={type} />

      {/* 印刷スタイル */}
      <style>{`
        @media print {
          @page { size: A5 landscape; margin: 0; }
          html, body { margin: 0; padding: 0; background: white !important; }
          .dn-page { margin: 8mm 10mm !important; }
        }
        @media screen {
          body { background: #e5e7eb; }
          .dn-wrapper { padding-top: 52px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; padding-bottom: 32px; }
          .dn-page { background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
        }
      `}</style>

      <div className="dn-wrapper">
        <div
          className="dn-page"
          style={{ width: "190mm", minHeight: "128mm", fontFamily: "'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP','Yu Gothic','Meiryo',sans-serif", fontSize: "10pt", color: "#1a1a1a" }}
        >
          {type === "standard"
            ? <StandardNote
                orderNo={orderNo}
                issuedAt={issuedAt}
                customerName={customer?.name ?? "—"}
                deliveryName={order.delivery_name}
                deliveryAddress={order.delivery_address ?? ""}
                deliveryPhone={deliveryPhone ?? null}
                deliveryEmail={deliveryEmail ?? null}
                deliveryDate={deliveryDateFmt}
                deliveryTime={deliveryTime}
                items={items ?? []}
                productName={order.product_name ?? ""}
                quantity={order.quantity}
                totalExcl={totalExcl}
                taxRate={taxRate}
                taxAmt={taxAmt}
                totalIncl={totalIncl}
                hasItems={hasItems}
                purpose={order.purpose ?? null}
                remarks={order.remarks ?? null}
              />
            : <GiftNote
                orderNo={orderNo}
                issuedAt={issuedAt}
                senderName={customer?.name ?? "—"}
                deliveryName={order.delivery_name}
                deliveryAddress={order.delivery_address ?? ""}
                deliveryPhone={deliveryPhone ?? null}
                deliveryDate={deliveryDateFmt}
                deliveryTime={deliveryTime}
                items={items ?? []}
                productName={order.product_name ?? ""}
                quantity={order.quantity}
                hasItems={hasItems}
                purpose={order.purpose ?? null}
                messageCard={order.message_card ?? null}
                remarks={order.remarks ?? null}
              />
          }
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════
// 自社宛 納品書
// ══════════════════════════════════════════════════
function StandardNote({
  orderNo, issuedAt,
  customerName,
  deliveryName, deliveryAddress, deliveryPhone, deliveryEmail,
  deliveryDate, deliveryTime,
  items, productName, quantity,
  totalExcl, taxRate, taxAmt, totalIncl,
  hasItems, purpose, remarks,
}: {
  orderNo: string; issuedAt: string;
  customerName: string;
  deliveryName: string; deliveryAddress: string;
  deliveryPhone: string | null; deliveryEmail: string | null;
  deliveryDate: string; deliveryTime: string | null;
  items: { id: string; product_name: string; description: string | null; quantity: number; unit_price: number; tax_rate: number }[];
  productName: string; quantity: number;
  totalExcl: number; taxRate: number; taxAmt: number; totalIncl: number;
  hasItems: boolean; purpose: string | null; remarks: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>
      {/* ── ヘッダー ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1a1a1a", paddingBottom: "6pt", marginBottom: "8pt" }}>
        <div>
          <p style={{ fontSize: "16pt", fontWeight: "700", margin: 0, lineHeight: 1.2 }}>{SHOP_NAME}</p>
          {(SHOP_POSTAL || SHOP_ADDRESS) && (
            <p style={{ fontSize: "8pt", color: "#555", margin: "2pt 0 0" }}>
              {SHOP_POSTAL && `${SHOP_POSTAL} `}{SHOP_ADDRESS}
            </p>
          )}
          {SHOP_TEL && (
            <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0 0" }}>TEL: {SHOP_TEL}</p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "18pt", fontWeight: "700", letterSpacing: "0.2em", margin: 0, lineHeight: 1.2 }}>納　品　書</p>
          <p style={{ fontSize: "8pt", color: "#555", margin: "3pt 0 0" }}>発行日: {issuedAt}</p>
          <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0 0" }}>No. {orderNo}</p>
        </div>
      </div>

      {/* ── 顧客 / お届け先 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6pt", marginBottom: "8pt" }}>
        <div style={{ border: "1px solid #d1d5db", borderRadius: "4pt", padding: "6pt 8pt" }}>
          <p style={{ fontSize: "7pt", color: "#6b7280", margin: "0 0 3pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>お客様</p>
          <p style={{ fontSize: "12pt", fontWeight: "700", margin: 0 }}>{customerName} 御中</p>
          {purpose && <p style={{ fontSize: "8pt", color: "#555", margin: "3pt 0 0" }}>用途: {purpose}</p>}
        </div>
        <div style={{ border: "1px solid #d1d5db", borderRadius: "4pt", padding: "6pt 8pt" }}>
          <p style={{ fontSize: "7pt", color: "#6b7280", margin: "0 0 3pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>お届け先</p>
          <p style={{ fontSize: "11pt", fontWeight: "700", margin: 0 }}>{deliveryName}</p>
          {deliveryAddress && <p style={{ fontSize: "8.5pt", margin: "2pt 0 0" }}>{deliveryAddress}</p>}
          {deliveryPhone && <p style={{ fontSize: "8pt", color: "#555", margin: "2pt 0 0" }}>TEL: {deliveryPhone}</p>}
          {deliveryEmail && <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0 0" }}>Email: {deliveryEmail}</p>}
          <p style={{ fontSize: "8.5pt", fontWeight: "600", margin: "3pt 0 0", color: "#1a4a8a" }}>
            お届け日: {deliveryDate}{deliveryTime && `　${deliveryTime}`}
          </p>
        </div>
      </div>

      {/* ── 商品明細テーブル ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6pt", fontSize: "9pt" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #1a1a1a", borderTop: "1px solid #1a1a1a" }}>
            <th style={{ textAlign: "left", padding: "4pt 6pt", fontWeight: "700", backgroundColor: "#f9fafb" }}>品名・説明</th>
            <th style={{ textAlign: "right", padding: "4pt 6pt", fontWeight: "700", backgroundColor: "#f9fafb", width: "36pt" }}>数量</th>
            <th style={{ textAlign: "right", padding: "4pt 6pt", fontWeight: "700", backgroundColor: "#f9fafb", width: "64pt" }}>単価（税抜）</th>
            <th style={{ textAlign: "right", padding: "4pt 6pt", fontWeight: "700", backgroundColor: "#f9fafb", width: "64pt" }}>金額（税込）</th>
          </tr>
        </thead>
        <tbody>
          {hasItems ? (
            items.map((item) => {
              const excl = item.quantity * item.unit_price;
              const tax  = Math.round(excl * item.tax_rate / 100);
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "4pt 6pt" }}>
                    <span style={{ fontWeight: "600" }}>{item.product_name}</span>
                    {item.description && (
                      <span style={{ fontSize: "8pt", color: "#6b7280", marginLeft: "6pt" }}>{item.description}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", padding: "4pt 6pt" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", padding: "4pt 6pt" }}>¥{item.unit_price.toLocaleString("ja-JP")}</td>
                  <td style={{ textAlign: "right", padding: "4pt 6pt", fontWeight: "600" }}>¥{(excl + tax).toLocaleString("ja-JP")}</td>
                </tr>
              );
            })
          ) : (
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "4pt 6pt", fontWeight: "600" }}>{productName}</td>
              <td style={{ textAlign: "right", padding: "4pt 6pt" }}>{quantity}</td>
              <td style={{ textAlign: "right", padding: "4pt 6pt", color: "#9ca3af" }}>—</td>
              <td style={{ textAlign: "right", padding: "4pt 6pt", color: "#9ca3af" }}>—</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── 合計 ── */}
      {hasItems && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8pt" }}>
          <div style={{ minWidth: "180pt", fontSize: "9pt" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 6pt", color: "#555" }}>
              <span>小計（税抜）</span>
              <span>¥{totalExcl.toLocaleString("ja-JP")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 6pt", color: "#555" }}>
              <span>消費税（{taxRate}%）</span>
              <span>¥{taxAmt.toLocaleString("ja-JP")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4pt 6pt", fontWeight: "700", fontSize: "11pt", borderTop: "1.5px solid #1a1a1a", marginTop: "2pt" }}>
              <span>合計（税込）</span>
              <span>¥{totalIncl.toLocaleString("ja-JP")}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 備考 ── */}
      {remarks && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "5pt", marginTop: "auto", fontSize: "8.5pt" }}>
          <span style={{ color: "#6b7280", fontWeight: "600" }}>備考：</span>
          <span style={{ marginLeft: "4pt" }}>{remarks}</span>
        </div>
      )}

      {/* ── フッター ── */}
      <div style={{ marginTop: remarks ? "4pt" : "auto", borderTop: "1px solid #e5e7eb", paddingTop: "4pt", display: "flex", justifyContent: "flex-end", fontSize: "8pt", color: "#9ca3af" }}>
        <span>{SHOP_NAME}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ギフト用 納品書
// ══════════════════════════════════════════════════
function GiftNote({
  orderNo, issuedAt,
  senderName,
  deliveryName, deliveryAddress, deliveryPhone,
  deliveryDate, deliveryTime,
  items, productName, quantity,
  hasItems, purpose, messageCard, remarks,
}: {
  orderNo: string; issuedAt: string;
  senderName: string;
  deliveryName: string; deliveryAddress: string;
  deliveryPhone: string | null;
  deliveryDate: string; deliveryTime: string | null;
  items: { id: string; product_name: string; description: string | null; quantity: number; unit_price: number; tax_rate: number }[];
  productName: string; quantity: number;
  hasItems: boolean; purpose: string | null;
  messageCard: string | null; remarks: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>
      {/* ── ヘッダー ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1a1a1a", paddingBottom: "6pt", marginBottom: "8pt" }}>
        <div>
          <p style={{ fontSize: "16pt", fontWeight: "700", margin: 0, lineHeight: 1.2 }}>{SHOP_NAME}</p>
          {(SHOP_POSTAL || SHOP_ADDRESS) && (
            <p style={{ fontSize: "8pt", color: "#555", margin: "2pt 0 0" }}>
              {SHOP_POSTAL && `${SHOP_POSTAL} `}{SHOP_ADDRESS}
            </p>
          )}
          {SHOP_TEL && (
            <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0 0" }}>TEL: {SHOP_TEL}</p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "18pt", fontWeight: "700", letterSpacing: "0.15em", margin: 0, lineHeight: 1.2 }}>ギフト納品書</p>
          <p style={{ fontSize: "8pt", color: "#555", margin: "3pt 0 0" }}>発行日: {issuedAt}</p>
          <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0 0" }}>No. {orderNo}</p>
        </div>
      </div>

      {/* ── 贈り主 / お届け先 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6pt", marginBottom: "8pt" }}>
        <div style={{ border: "1px solid #d1d5db", borderRadius: "4pt", padding: "6pt 8pt" }}>
          <p style={{ fontSize: "7pt", color: "#6b7280", margin: "0 0 3pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>贈り主</p>
          <p style={{ fontSize: "12pt", fontWeight: "700", margin: 0 }}>{senderName} 様</p>
          {purpose && <p style={{ fontSize: "8pt", color: "#555", margin: "3pt 0 0" }}>用途: {purpose}</p>}
        </div>
        <div style={{ border: "1px solid #d1d5db", borderRadius: "4pt", padding: "6pt 8pt", backgroundColor: "#fef9f0", borderColor: "#f3d89a" }}>
          <p style={{ fontSize: "7pt", color: "#92610a", margin: "0 0 3pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>お届け先</p>
          <p style={{ fontSize: "11pt", fontWeight: "700", margin: 0 }}>{deliveryName} 様</p>
          {deliveryAddress && <p style={{ fontSize: "8.5pt", margin: "2pt 0 0" }}>{deliveryAddress}</p>}
          {deliveryPhone && <p style={{ fontSize: "8pt", color: "#555", margin: "2pt 0 0" }}>TEL: {deliveryPhone}</p>}
          <p style={{ fontSize: "8.5pt", fontWeight: "600", margin: "3pt 0 0", color: "#1a4a8a" }}>
            お届け日: {deliveryDate}{deliveryTime && `　${deliveryTime}`}
          </p>
        </div>
      </div>

      {/* ── 商品 ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8pt", fontSize: "9pt" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #1a1a1a", borderTop: "1px solid #1a1a1a" }}>
            <th style={{ textAlign: "left", padding: "4pt 6pt", fontWeight: "700", backgroundColor: "#f9fafb" }}>品名・説明</th>
            <th style={{ textAlign: "right", padding: "4pt 6pt", fontWeight: "700", backgroundColor: "#f9fafb", width: "42pt" }}>数量</th>
          </tr>
        </thead>
        <tbody>
          {hasItems ? (
            items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "4pt 6pt" }}>
                  <span style={{ fontWeight: "600" }}>{item.product_name}</span>
                  {item.description && (
                    <span style={{ fontSize: "8pt", color: "#6b7280", marginLeft: "6pt" }}>{item.description}</span>
                  )}
                </td>
                <td style={{ textAlign: "right", padding: "4pt 6pt" }}>{item.quantity}</td>
              </tr>
            ))
          ) : (
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "4pt 6pt", fontWeight: "600" }}>{productName}</td>
              <td style={{ textAlign: "right", padding: "4pt 6pt" }}>{quantity}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── メッセージカード ── */}
      {messageCard && (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: "4pt", padding: "6pt 10pt", marginBottom: "6pt", backgroundColor: "#fafafa" }}>
          <p style={{ fontSize: "7.5pt", color: "#6b7280", margin: "0 0 4pt", fontWeight: "600" }}>📝 メッセージカード</p>
          <p style={{ fontSize: "9.5pt", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{messageCard}</p>
        </div>
      )}

      {/* ── 備考 ── */}
      {remarks && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "5pt", marginTop: "auto", fontSize: "8.5pt" }}>
          <span style={{ color: "#6b7280", fontWeight: "600" }}>備考：</span>
          <span style={{ marginLeft: "4pt" }}>{remarks}</span>
        </div>
      )}

      {/* ── フッター ── */}
      <div style={{ marginTop: (messageCard || remarks) ? "4pt" : "auto", borderTop: "1px solid #e5e7eb", paddingTop: "4pt", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8pt", color: "#9ca3af" }}>
        <span style={{ fontSize: "7.5pt" }}>※ 金額の記載のない納品書です</span>
        <span>{SHOP_NAME}</span>
      </div>
    </div>
  );
}
