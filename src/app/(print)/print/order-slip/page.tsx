import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintBar } from "@/components/ui/PrintBar";

// ── 定数 ─────────────────────────────────────────────────
const B  = "1px solid #000";  // 外枠・通常罫線
const BT = "2px solid #000";  // 太罫線（外枠用）

// ── セルスタイル共通 ──────────────────────────────────────
const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  border: B,
  padding: "1.5pt 4pt",
  verticalAlign: "middle",
  ...extra,
});

// ── 縦書きラベルセル ──────────────────────────────────────
const vLabel = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  ...cell(),
  textAlign:       "center",
  verticalAlign:   "middle",
  writingMode:     "vertical-rl" as const,
  textOrientation: "upright" as const,
  letterSpacing:   "0.2em",
  fontWeight:      "bold",
  fontSize:        "11pt",
  ...extra,
});

export default async function OrderSlipPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  const FONT = '"MS Gothic", "Osaka", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';

  return (
    <>
      <PrintBar title="📋 御注文票" />

      <style>{`
        * { box-sizing: border-box; }

        @media print {
          /* A5 縦（148×210mm）、余白は最小限。ブラウザ側「ヘッダーとフッター」はOFF推奨 */
          @page { size: A5 portrait; margin: 6mm; }
          html, body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .slip-wrapper { padding: 0 !important; background: none !important; }
          /* 印刷時はページを物理寸法で固定し、絶対に 1 枚に収める */
          .slip-page {
            width: 136mm !important;   /* 148mm - 6mm*2 */
            height: 198mm !important;  /* 210mm - 6mm*2 */
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
          .slip-wrapper {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px 16px 48px;
          }
          .slip-page {
            background: white;
            box-shadow: 0 8px 40px rgba(0,0,0,0.22);
            /* プレビューも印刷時と同じ物理寸法にそろえる（枠内に収まるか確認しやすい） */
            width: 136mm;
            height: 198mm;
            padding: 0;
            overflow: hidden;
          }
        }

        .slip-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: ${BT};
        }
        .slip-table td { border: ${B}; padding: 0; }
      `}</style>

      <div className="slip-wrapper">
        <div className="slip-page">

          {/* ── 日付行（表の外、右寄せ） ── */}
          <div style={{
            fontFamily:    FONT,
            fontSize:      "10pt",
            textAlign:     "right",
            paddingRight:  "2mm",
            marginBottom:  "1.5mm",
            letterSpacing: "0.05em",
          }}>
            年&emsp;&emsp;&emsp;月&emsp;&emsp;&emsp;日
          </div>

          {/* ══ 御注文票テーブル ══
              12等分カラム（各 ~8.33%）
              ─ ラベル列 : cols 1–2 (16.7%)
              ─ コンテンツ列 : cols 3–12 (83.3%)
          */}
          <table className="slip-table" style={{ fontFamily: FONT }}>
            <colgroup>
              {/* 12カラムを均等に */}
              {Array.from({ length: 12 }).map((_, i) => (
                <col key={i} style={{ width: `${100 / 12}%` }} />
              ))}
            </colgroup>
            <tbody>

              {/* ── 行1: タイトル + 扱者 ── */}
              <tr style={{ height: "9mm" }}>
                <td
                  colSpan={7}
                  style={{
                    ...cell(),
                    fontSize:      "13pt",
                    fontWeight:    "bold",
                    padding:       "1mm 3mm",
                    letterSpacing: "0.1em",
                  }}
                >
                  ＜御注文票＞
                </td>
                <td
                  colSpan={5}
                  style={{
                    ...cell(),
                    fontSize:  "10pt",
                    padding:   "1mm 3mm",
                    textAlign: "left",
                  }}
                >
                  扱者（&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;）
                </td>
              </tr>

              {/* ── 行2: 注文種別 ── */}
              <tr style={{ height: "13mm" }}>
                {(["御　来　店", "配　　　達", "宅　　　配"] as const).map((label) => (
                  <td
                    key={label}
                    colSpan={4}
                    style={{
                      ...cell(),
                      textAlign:     "center",
                      fontSize:      "15pt",
                      fontWeight:    "bold",
                      letterSpacing: "0.15em",
                      padding:       "1mm",
                    }}
                  >
                    {label}
                  </td>
                ))}
              </tr>

              {/* ── 行3: ご住所 ── */}
              <tr style={{ height: "16mm" }}>
                {/* 御注文主ラベル（行3〜5でrowSpan=3） */}
                <td
                  rowSpan={3}
                  colSpan={2}
                  style={vLabel({ fontSize: "12pt", letterSpacing: "0.3em" })}
                >
                  御注文主
                </td>
                <td
                  colSpan={10}
                  style={{
                    ...cell(),
                    verticalAlign: "top",
                    padding:       "1.5mm 3mm",
                    fontSize:      "8pt",
                  }}
                >
                  ご住所
                </td>
              </tr>

              {/* ── 行4: TEL ── */}
              <tr style={{ height: "11mm" }}>
                <td
                  colSpan={10}
                  style={{
                    ...cell(),
                    textAlign:  "center",
                    fontSize:   "11pt",
                    padding:    "1mm 3mm",
                    letterSpacing: "0.05em",
                  }}
                >
                  TEL.&emsp;&emsp;&emsp;（&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;）
                </td>
              </tr>

              {/* ── 行5: お名前 ── */}
              <tr style={{ height: "12mm" }}>
                {/* 名前記入欄（9カラム） */}
                <td
                  colSpan={9}
                  style={{
                    ...cell(),
                    verticalAlign: "top",
                    padding:       "1.5mm 3mm",
                    fontSize:      "8pt",
                  }}
                >
                  お名前
                </td>
                {/* 様（1カラム） */}
                <td
                  colSpan={1}
                  style={{
                    ...cell(),
                    textAlign:     "center",
                    verticalAlign: "bottom",
                    fontSize:      "14pt",
                    fontWeight:    "bold",
                    paddingBottom: "1.5mm",
                  }}
                >
                  様
                </td>
              </tr>

              {/* ── 行6: 御来店（来店日） ── */}
              <tr style={{ height: "10mm" }}>
                <td
                  colSpan={2}
                  style={{
                    ...cell(),
                    textAlign:     "center",
                    fontWeight:    "bold",
                    fontSize:      "12pt",
                    letterSpacing: "0.2em",
                  }}
                >
                  御来店
                </td>
                {/* 月数字記入欄 */}
                <td colSpan={2} style={cell()} />
                <td colSpan={1} style={{ ...cell(), textAlign: "center", fontSize: "12pt" }}>月</td>
                {/* 日数字記入欄 */}
                <td colSpan={2} style={cell()} />
                <td colSpan={1} style={{ ...cell(), textAlign: "center", fontSize: "12pt" }}>日</td>
                {/* 曜日記入欄 */}
                <td colSpan={4} style={{ ...cell(), textAlign: "center", fontSize: "12pt" }}>
                  （&emsp;&emsp;&emsp;）
                </td>
              </tr>

              {/* ── 行7: 御使用（使用日） ── */}
              <tr style={{ height: "10mm" }}>
                <td
                  colSpan={2}
                  style={{
                    ...cell(),
                    textAlign:     "center",
                    fontWeight:    "bold",
                    fontSize:      "12pt",
                    letterSpacing: "0.2em",
                  }}
                >
                  御使用
                </td>
                <td colSpan={2} style={cell()} />
                <td colSpan={1} style={{ ...cell(), textAlign: "center", fontSize: "12pt" }}>月</td>
                <td colSpan={2} style={cell()} />
                <td colSpan={1} style={{ ...cell(), textAlign: "center", fontSize: "12pt" }}>日</td>
                <td colSpan={4} style={{ ...cell(), textAlign: "center", fontSize: "12pt" }}>
                  （&emsp;&emsp;&emsp;）
                </td>
              </tr>

              {/* ── 行8: 品名 ── */}
              <tr style={{ height: "33mm" }}>
                <td colSpan={2} style={vLabel()}>品名</td>
                <td colSpan={10} style={cell()} />
              </tr>

              {/* ── 行9: 花入 ── */}
              <tr style={{ height: "33mm" }}>
                <td colSpan={2} style={vLabel()}>花入</td>
                <td colSpan={10} style={cell()} />
              </tr>

              {/* ── 行10: 備考 ── */}
              <tr style={{ height: "33mm" }}>
                <td colSpan={2} style={vLabel()}>備考</td>
                <td colSpan={10} style={cell()} />
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
