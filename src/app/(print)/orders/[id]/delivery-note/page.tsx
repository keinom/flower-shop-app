import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintActions } from "./PrintActions";

// ── 店舗情報 ───────────────────────────────────────
const SHOP_NAME    = "花長";
const SHOP_ADDRESS = "東京都港区南青山 7-12-9";
const SHOP_TEL     = "03-3407-0211";
const SHOP_FAX     = "03-3407-0245";
const SHOP_EMAIL   = "info@aoyama-hanacho.com";
// ────────────────────────────────────────────────────

// 配送料の品名は「配送料」とだけ表示する
function trimProductName(name: string): string {
  if (name.startsWith("配送料")) return "配送料";
  return name;
}

// デザイントークン
const GOLD   = "#8B6914";
const GOLD_L = "#f5edda";
const RULE   = "#c9b97a";
const GRAY1  = "#1a1a1a";
const GRAY2  = "#4b4541";
const GRAY3  = "#7c6f60";
const GRAY4  = "#bfb49a";
const BG_ROW = "#faf8f4";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function DeliveryNotePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const type = sp.type === "gift" ? "gift" : "standard";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/customer");

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
    postal_code: string | null; address: string | null;
  } | null;

  const hasItems  = items != null && items.length > 0;
  const totalExcl = hasItems ? items!.reduce((s, i) => s + i.quantity * i.unit_price, 0) : 0;
  const taxRate   = hasItems ? items![0].tax_rate : 10;
  const taxAmt    = Math.round(totalExcl * taxRate / 100);
  const totalIncl = totalExcl + taxAmt;

  const issuedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const deliveryDateFmt = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString("ja-JP", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      })
    : "未定";

  const timeStart    = (order as { delivery_time_start?: string | null }).delivery_time_start;
  const timeEnd      = (order as { delivery_time_end?: string | null }).delivery_time_end;
  const deliveryTime = timeStart || timeEnd
    ? `${timeStart ? timeStart.slice(0, 5) : ""}〜${timeEnd ? timeEnd.slice(0, 5) : ""}`
    : null;

  const deliveryPhone      = (order as { delivery_phone?: string | null }).delivery_phone;
  const deliveryEmail      = (order as { delivery_email?: string | null }).delivery_email;
  const deliveryPostalCode = (order as { delivery_postal_code?: string | null }).delivery_postal_code;
  const orderNo = `DEC${id.slice(0, 8).toUpperCase()}`;

  return (
    <>
      <PrintActions orderId={id} currentType={type} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;700&display=swap');

        @media print {
          @page { size: A5 landscape; margin: 0; }
          html, body { margin: 0; padding: 0; background: white !important; }
          .dn-page {
            margin: 0 !important;
            padding: 12mm 14mm !important;
            box-shadow: none !important;
            width: 210mm !important;
          }
        }
        @media screen {
          body { background: #e8e3dc; }
          .dn-wrapper {
            padding-top: 60px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-bottom: 40px;
          }
          .dn-page {
            background: white;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18);
            padding: 12mm 14mm;
          }
        }
      `}</style>

      <div className="dn-wrapper">
        <div
          className="dn-page"
          style={{
            width: "210mm",
            minHeight: "148mm",
            boxSizing: "border-box",
            fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
            fontSize: "9pt",
            color: GRAY1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {type === "standard"
            ? <StandardNote
                orderNo={orderNo} issuedAt={issuedAt}
                deliveryName={order.delivery_name}
                items={items ?? []}
                productName={order.product_name ?? ""}
                quantity={order.quantity}
                totalExcl={totalExcl} taxRate={taxRate} taxAmt={taxAmt} totalIncl={totalIncl}
                hasItems={hasItems}
              />
            : <GiftNote
                orderNo={orderNo} issuedAt={issuedAt}
                senderName={customer?.name ?? "—"}
                senderPostalCode={customer?.postal_code ?? null}
                senderAddress={customer?.address ?? null}
                senderPhone={customer?.phone ?? null}
                deliveryName={order.delivery_name}
                deliveryPostalCode={deliveryPostalCode ?? null}
                deliveryAddress={order.delivery_address ?? ""}
                deliveryPhone={deliveryPhone ?? null}
                deliveryDate={deliveryDateFmt}
              />
          }
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────
// 共通: ヘッダー
// ────────────────────────────────────────────────────
function NoteHeader({ title, orderNo, issuedAt }: { title: string; orderNo: string; issuedAt: string }) {
  return (
    <div style={{ marginBottom: "10pt" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        {/* 左: タイトル + 発行情報 */}
        <div>
          <div style={{
            fontSize: "20pt",
            fontWeight: "700",
            letterSpacing: "0.3em",
            color: GRAY1,
            lineHeight: 1,
            marginBottom: "5pt",
          }}>
            {title}
          </div>
          <div style={{ fontSize: "7.5pt", color: GRAY3, lineHeight: 1.8 }}>
            <div>発行日：{issuedAt}</div>
            <div style={{ letterSpacing: "0.02em" }}>No. {orderNo}</div>
          </div>
        </div>

        {/* 右: ロゴ + 店舗情報 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3pt" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={SHOP_NAME}
            style={{ height: "32pt", width: "auto", objectFit: "contain", objectPosition: "right center" }}
          />
          <div style={{ fontSize: "7pt", color: GRAY3, lineHeight: 1.6, marginTop: "1pt", textAlign: "right" }}>
            <div>{SHOP_ADDRESS}</div>
            <div>TEL {SHOP_TEL}　FAX {SHOP_FAX}</div>
            <div>{SHOP_EMAIL}</div>
          </div>
        </div>
      </div>

      {/* 区切り線: 2本 */}
      <div style={{ marginTop: "7pt", borderTop: `2px solid ${GOLD}` }} />
      <div style={{ marginTop: "1.5pt", borderTop: `0.5px solid ${RULE}` }} />
    </div>
  );
}

// ────────────────────────────────────────────────────
// 共通: 情報ボックス
// ────────────────────────────────────────────────────
function InfoBox({
  label, labelColor = GOLD, name, lines = [], accent = false,
}: {
  label: string;
  labelColor?: string;
  name: string;
  lines?: string[];
  accent?: boolean;
}) {
  return (
    <div style={{
      border: `1px solid ${accent ? RULE : "#ddd8ce"}`,
      borderRadius: "3pt",
      padding: "7pt 10pt",
      backgroundColor: accent ? GOLD_L : "#fdfcfa",
    }}>
      <div style={{
        fontSize: "6.5pt",
        fontWeight: "700",
        color: labelColor,
        letterSpacing: "0.12em",
        marginBottom: "4pt",
        textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{ fontSize: "12pt", fontWeight: "700", lineHeight: 1.3, marginBottom: lines.length ? "4pt" : 0 }}>
        {name}
      </div>
      {lines.map((l, i) => l ? (
        <div key={i} style={{ fontSize: "8pt", color: GRAY2, lineHeight: 1.7 }}>{l}</div>
      ) : null)}
    </div>
  );
}

// ────────────────────────────────────────────────────
// 自社宛 納品書
// ────────────────────────────────────────────────────
function StandardNote({
  orderNo, issuedAt,
  deliveryName,
  items, productName, quantity,
  totalExcl, taxRate, taxAmt, totalIncl,
  hasItems,
}: {
  orderNo: string; issuedAt: string;
  deliveryName: string;
  items: { id: string; product_name: string; description: string | null; quantity: number; unit_price: number; tax_rate: number }[];
  productName: string; quantity: number;
  totalExcl: number; taxRate: number; taxAmt: number; totalIncl: number;
  hasItems: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <NoteHeader title="納　品　書" orderNo={orderNo} issuedAt={issuedAt} />

      {/* お届け先 */}
      <div style={{
        border: `1px solid #ddd8ce`,
        borderRadius: "3pt",
        padding: "8pt 14pt",
        backgroundColor: "white",
        marginBottom: "10pt",
      }}>
        <div style={{ fontSize: "6.5pt", fontWeight: "700", color: GRAY3, letterSpacing: "0.12em", marginBottom: "5pt" }}>お届け先</div>
        <div style={{ fontSize: "13pt", fontWeight: "700", lineHeight: 1.3 }}>
          {deliveryName}<span style={{ fontSize: "9pt", fontWeight: "500", marginLeft: "3pt" }}>様</span>
        </div>
      </div>

      {/* 明細テーブル */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
        <thead>
          <tr>
            {(["品名", "数量", "単価（税抜）", "金額（税込）"] as const).map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  padding: "4.5pt 8pt",
                  fontWeight: "700",
                  fontSize: "7.5pt",
                  letterSpacing: "0.04em",
                  color: GOLD,
                  borderTop: `1.5px solid ${RULE}`,
                  borderBottom: `1px solid ${RULE}`,
                  backgroundColor: BG_ROW,
                  width: i === 0 ? "auto" : i === 1 ? "42pt" : "68pt",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasItems ? (
            items.map((item, idx) => {
              const excl = item.quantity * item.unit_price;
              const tax  = Math.round(excl * item.tax_rate / 100);
              return (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? BG_ROW : "white" }}>
                  <td style={{ padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3` }}>
                    <span style={{ fontWeight: "600" }}>{trimProductName(item.product_name)}</span>
                  </td>
                  <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, whiteSpace: "nowrap" }}>¥{item.unit_price.toLocaleString("ja-JP")}</td>
                  <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, fontWeight: "600" }}>¥{(excl + tax).toLocaleString("ja-JP")}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td style={{ padding: "4pt 8pt", fontWeight: "600", borderBottom: `0.5px solid #e5dfd3` }}>{productName}</td>
              <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3` }}>{quantity}</td>
              <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, color: GRAY4 }}>—</td>
              <td style={{ textAlign: "right", padding: "4pt 8pt", borderBottom: `0.5px solid #e5dfd3`, color: GRAY4 }}>—</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 合計 */}
      {hasItems && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6pt" }}>
          <div style={{ minWidth: "170pt", fontSize: "8.5pt" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 8pt", color: GRAY3 }}>
              <span>小計（税抜）</span>
              <span>¥{totalExcl.toLocaleString("ja-JP")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 8pt", color: GRAY3 }}>
              <span>消費税（{taxRate}%）</span>
              <span>¥{taxAmt.toLocaleString("ja-JP")}</span>
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
              <span>¥{totalIncl.toLocaleString("ja-JP")}</span>
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <div style={{ marginTop: "auto", paddingTop: "8pt" }}>
        <div style={{ borderTop: `0.5px solid ${RULE}`, paddingTop: "3pt" }} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// ギフト用 納品書
// ────────────────────────────────────────────────────
function GiftNote({
  orderNo, issuedAt,
  senderName, senderPostalCode, senderAddress, senderPhone,
  deliveryName, deliveryPostalCode, deliveryAddress, deliveryPhone,
  deliveryDate,
}: {
  orderNo: string; issuedAt: string;
  senderName: string; senderPostalCode: string | null; senderAddress: string | null; senderPhone: string | null;
  deliveryName: string; deliveryPostalCode: string | null; deliveryAddress: string; deliveryPhone: string | null;
  deliveryDate: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <NoteHeader title="納　品　書" orderNo={orderNo} issuedAt={issuedAt} />

      {/* ① 贈り主 */}
      <div style={{
        border: `1px solid #ddd8ce`,
        borderRadius: "3pt",
        padding: "8pt 14pt",
        backgroundColor: "white",
        marginBottom: "6pt",
      }}>
        <div style={{ fontSize: "6.5pt", fontWeight: "700", color: GRAY3, letterSpacing: "0.12em", marginBottom: "5pt" }}>贈り主</div>
        <div style={{ fontSize: "13pt", fontWeight: "700", lineHeight: 1.3, marginBottom: "4pt" }}>
          {senderName}<span style={{ fontSize: "9pt", fontWeight: "500", marginLeft: "3pt" }}>様</span>
        </div>
        {senderPostalCode && <div style={{ fontSize: "10pt", color: GRAY2, lineHeight: 1.6 }}>〒{senderPostalCode}</div>}
        {senderAddress    && <div style={{ fontSize: "10pt", color: GRAY2, lineHeight: 1.6 }}>{senderAddress}</div>}
        {senderPhone      && <div style={{ fontSize: "10pt", color: GRAY2, lineHeight: 1.6 }}>電話番号 {senderPhone}</div>}
      </div>

      {/* ② お届け先 */}
      <div style={{
        border: `1px solid #ddd8ce`,
        borderRadius: "3pt",
        padding: "8pt 14pt",
        backgroundColor: "white",
        marginBottom: "6pt",
      }}>
        <div style={{ fontSize: "6.5pt", fontWeight: "700", color: GRAY3, letterSpacing: "0.12em", marginBottom: "5pt" }}>お届け先</div>
        <div style={{ fontSize: "13pt", fontWeight: "700", lineHeight: 1.3, marginBottom: "4pt" }}>
          {deliveryName}<span style={{ fontSize: "9pt", fontWeight: "500", marginLeft: "3pt" }}>様</span>
        </div>
        {deliveryPostalCode && <div style={{ fontSize: "10pt", color: GRAY2, lineHeight: 1.6 }}>〒{deliveryPostalCode}</div>}
        {deliveryAddress    && <div style={{ fontSize: "10pt", color: GRAY2, lineHeight: 1.6 }}>{deliveryAddress}</div>}
        {deliveryPhone      && <div style={{ fontSize: "10pt", color: GRAY2, lineHeight: 1.6 }}>電話番号 {deliveryPhone}</div>}
      </div>

      {/* ③ お届け日 */}
      <div style={{
        border: `1px solid #ddd8ce`,
        borderRadius: "3pt",
        padding: "5pt 14pt",
        backgroundColor: "#fdfcfa",
        marginBottom: "6pt",
        display: "inline-flex",
        alignItems: "center",
        gap: "14pt",
        alignSelf: "flex-start",
      }}>
        <span style={{ fontSize: "6.5pt", fontWeight: "700", color: GOLD, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>お届け日</span>
        <span style={{ fontSize: "10pt", fontWeight: "600", color: GRAY1 }}>{deliveryDate}</span>
      </div>

      {/* フッター: メッセージ */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: "8pt" }} />
        <div style={{
          fontSize: "8pt",
          color: GRAY3,
          lineHeight: 2,
          letterSpacing: "0.08em",
          textAlign: "center",
          fontStyle: "italic",
        }}>
          お花のご注文やご相談など、どうぞいつでもお気軽にお問い合わせくださいませ。
        </div>
        <div style={{ borderTop: `0.5px solid ${RULE}`, marginTop: "8pt" }} />
      </div>
    </div>
  );
}
