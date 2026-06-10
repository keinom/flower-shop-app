import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintBar } from "@/components/ui/PrintBar";

// ── 罫線定数 ────────────────────────────────────────────────
const B  = "1px solid #000";
const BT = "2px solid #000";

const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  border: B,
  padding: "1.5pt 4pt",
  verticalAlign: "middle",
  ...extra,
});

const vLabel = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  ...cell(),
  textAlign:       "center",
  verticalAlign:   "middle",
  writingMode:     "vertical-rl" as const,
  textOrientation: "upright" as const,
  letterSpacing:   "0.15em",
  fontWeight:      "bold",
  fontSize:        "11pt",
  ...extra,
});

// ── 住所行（点線3本） ──────────────────────────────────────
const AddressLines = () => (
  <div style={{ paddingTop: "1mm" }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          borderBottom: "1px dotted #555",
          height: "5mm",
        }}
      />
    ))}
  </div>
);

export default async function OrderReceiptPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  const FONT = '"MS Gothic", "Osaka", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';

  return (
    <>
      <PrintBar title="📋 ご注文票" />

      <style>{`
        * { box-sizing: border-box; }

        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-wrapper { padding: 0 !important; background: none !important; }
          .receipt-page {
            width: 194mm !important;   /* 210mm - 8mm*2 */
            height: 281mm !important;  /* 297mm - 8mm*2 */
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        @media screen {
          body { background: #cbc7c0 !important; padding-top: 56px; }
          .receipt-wrapper {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px 16px 48px;
          }
          .receipt-page {
            background: white;
            box-shadow: 0 8px 40px rgba(0,0,0,0.22);
            width: 194mm;
            height: 281mm;
            padding: 0;
            overflow: hidden;
          }
        }

        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: ${BT};
        }
        .receipt-table td { border: ${B}; padding: 0; }
      `}</style>

      <div className="receipt-wrapper">
        <div className="receipt-page">
          <table className="receipt-table" style={{ fontFamily: FONT }}>
            <colgroup>
              {Array.from({ length: 24 }).map((_, i) => (
                <col key={i} style={{ width: `${100 / 24}%` }} />
              ))}
            </colgroup>
            <tbody>

              {/* ── 行1: 注文受票 / 令和　年　月　日受付 / 担当 ── */}
              <tr style={{ height: "12mm" }}>
                <td
                  colSpan={9}
                  style={{
                    ...cell(),
                    fontSize:   "14pt",
                    fontWeight: "bold",
                    padding:    "2mm 4mm",
                  }}
                >
                  注文受票
                </td>
                <td
                  colSpan={15}
                  style={{
                    ...cell(),
                    fontSize: "11pt",
                    padding:  "1.5mm 4mm",
                    textAlign: "right",
                  }}
                >
                  <div>令和&emsp;&emsp;年&emsp;&emsp;月&emsp;&emsp;日受付</div>
                  <div style={{ marginTop: "2mm" }}>担当（&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;）</div>
                </td>
              </tr>

              {/* ── 行2: 配達日 + 種別 + 時間帯 ── */}
              <tr style={{ height: "10mm" }}>
                <td
                  colSpan={24}
                  style={{
                    ...cell(),
                    fontSize: "11pt",
                    padding:  "1.5mm 4mm",
                    letterSpacing: "0.04em",
                  }}
                >
                  令和&emsp;&emsp;年&emsp;&emsp;月&emsp;&emsp;日（&emsp;&emsp;）&emsp;&emsp;
                  配達&emsp;御来店&emsp;発送&emsp;&emsp;&emsp;AM/PM&emsp;&emsp;送&emsp;
                </td>
              </tr>

              {/* ══════ 御届先様 ══════ */}
              <tr style={{ height: "10mm" }}>
                <td
                  rowSpan={4}
                  colSpan={3}
                  style={vLabel({
                    fontSize: "12pt",
                    letterSpacing: "0.3em",
                  })}
                >
                  御届先様
                </td>
                <td colSpan={21} style={{ ...cell(), padding: "1.5mm 4mm", fontSize: "10pt" }}>
                  ご住所
                </td>
              </tr>
              <tr style={{ height: "20mm" }}>
                <td colSpan={21} style={{ ...cell(), padding: "0 4mm" }}>
                  <AddressLines />
                </td>
              </tr>
              <tr style={{ height: "9mm" }}>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1.5mm 4mm", fontSize: "10.5pt", textAlign: "center" }}
                >
                  TEL/携帯電話&emsp;&emsp;&emsp;（&emsp;&emsp;&emsp;&emsp;&emsp;）
                </td>
              </tr>
              <tr style={{ height: "12mm" }}>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1mm 4mm", fontSize: "12pt", textAlign: "right", verticalAlign: "bottom" }}
                >
                  様
                </td>
              </tr>

              {/* ══════ 御注文主 ══════ */}
              <tr style={{ height: "10mm" }}>
                <td
                  rowSpan={4}
                  colSpan={3}
                  style={vLabel({
                    fontSize: "12pt",
                    letterSpacing: "0.3em",
                  })}
                >
                  御注文主
                </td>
                <td colSpan={21} style={{ ...cell(), padding: "1.5mm 4mm", fontSize: "10pt" }}>
                  ご住所
                </td>
              </tr>
              <tr style={{ height: "20mm" }}>
                <td colSpan={21} style={{ ...cell(), padding: "0 4mm" }}>
                  <AddressLines />
                </td>
              </tr>
              <tr style={{ height: "9mm" }}>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1.5mm 4mm", fontSize: "10.5pt", textAlign: "center" }}
                >
                  TEL/携帯電話&emsp;&emsp;&emsp;（&emsp;&emsp;&emsp;&emsp;&emsp;）
                </td>
              </tr>
              <tr style={{ height: "12mm" }}>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1mm 4mm", fontSize: "12pt", textAlign: "right", verticalAlign: "bottom" }}
                >
                  様
                </td>
              </tr>

              {/* ══════ 御用途 ══════ */}
              <tr style={{ height: "10mm" }}>
                <td
                  colSpan={3}
                  style={{ ...cell(), textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}
                >
                  御用途
                </td>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1.5mm 4mm", fontSize: "11pt" }}
                >
                  お祝い（&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;/お誕生日）&emsp;御供（&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;）
                </td>
              </tr>

              {/* ══════ 品名 (2行 × 4列 のチェック欄) ══════ */}
              <tr style={{ height: "9mm" }}>
                <td
                  rowSpan={2}
                  colSpan={3}
                  style={{ ...cell(), textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}
                >
                  品名
                </td>
                <td colSpan={5} style={{ ...cell(), padding: "1mm 3mm", fontSize: "10.5pt" }}>アレンジメント</td>
                <td colSpan={5} style={{ ...cell(), padding: "1mm 3mm", fontSize: "10.5pt" }}>盛り花</td>
                <td colSpan={5} style={{ ...cell(), padding: "1mm 3mm", fontSize: "10.5pt" }}>花束</td>
                <td colSpan={6} style={{ ...cell() }} />
              </tr>
              <tr style={{ height: "9mm" }}>
                <td colSpan={5} style={{ ...cell(), padding: "1mm 3mm", fontSize: "10.5pt" }}>鉢植</td>
                <td colSpan={5} style={{ ...cell(), padding: "1mm 3mm", fontSize: "10.5pt" }}>スタンド花</td>
                <td colSpan={5} style={{ ...cell(), padding: "1mm 3mm", fontSize: "10.5pt" }}>その他</td>
                <td colSpan={6} style={{ ...cell() }} />
              </tr>

              {/* ══════ 金額 ══════ */}
              <tr style={{ height: "13mm" }}>
                <td
                  colSpan={3}
                  style={{ ...cell(), textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}
                >
                  金額
                </td>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1mm 4mm", fontSize: "12pt", textAlign: "right", verticalAlign: "bottom" }}
                >
                  計&nbsp;¥
                </td>
              </tr>

              {/* ══════ 支払方法 ══════ */}
              <tr style={{ height: "10mm" }}>
                <td
                  colSpan={3}
                  style={{ ...cell(), textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}
                >
                  支払方法
                </td>
                <td
                  colSpan={21}
                  style={{ ...cell(), padding: "1.5mm 4mm", fontSize: "11pt", textAlign: "center" }}
                >
                  代済&emsp;・&emsp;未納&emsp;&emsp;（掛&emsp;&emsp;&emsp;&emsp;納品時払）
                </td>
              </tr>

              {/* ══════ カード/名札/備考 ══════ */}
              <tr style={{ height: "60mm" }}>
                <td
                  colSpan={3}
                  style={{
                    ...cell(),
                    textAlign: "center",
                    verticalAlign: "top",
                    padding: "2mm 1mm",
                    fontSize: "10.5pt",
                    lineHeight: 1.6,
                  }}
                >
                  カード<br />名札<br />備考<br />詳細は裏
                </td>
                <td colSpan={21} style={{ ...cell() }} />
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
