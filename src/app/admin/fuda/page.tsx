import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FudaUploadModal } from "@/components/admin/FudaUploadModal";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

interface FudaDoc {
  id:             string;
  file_name:      string;
  occasion:       string | null;
  recipient:      string | null;
  sender:         string | null;
  all_text:       string | null;
  ocr_done:       boolean;
  ocr_error:      string | null;
  ocr_confidence: string | null;
  created_at:     string;
}

// ── ヘルパー ──────────────────────────────────────────
// 検索ワードが含まれる箇所の前後を抜粋して返す
function getExcerpt(text: string | null, query: string, maxLen = 110): string {
  if (!text) return "";
  const clean = text.replace(/\n+/g, " ").trim();
  if (!query) return clean.slice(0, maxLen) + (clean.length > maxLen ? "…" : "");

  const idx = clean.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return clean.slice(0, maxLen) + (clean.length > maxLen ? "…" : "");

  const pad   = 30;
  const start = Math.max(0, idx - pad);
  const end   = Math.min(clean.length, idx + query.length + (maxLen - pad));
  const slice = clean.slice(start, end);
  return (start > 0 ? "…" : "") + slice + (end < clean.length ? "…" : "");
}

// 検索ワードをハイライト（<mark>タグ）
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// OCR ステータスバッジ
function OcrBadge({ done, error, confidence }: { done: boolean; error: string | null; confidence: string | null }) {
  if (!done)   return <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">OCR処理中</span>;
  if (error)   return <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">OCRエラー</span>;
  const map = { high: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", low: "bg-red-100 text-red-600" };
  const cls = (confidence && map[confidence as keyof typeof map]) ?? "bg-gray-100 text-gray-500";
  const lbl = confidence === "high" ? "精度:高" : confidence === "medium" ? "精度:中" : confidence === "low" ? "精度:低" : "";
  if (!lbl) return null;
  return <span className={`text-xs px-1.5 py-0.5 rounded-full ${cls}`}>{lbl}</span>;
}

// ── ページ ────────────────────────────────────────────
export default async function FudaListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q  = sp.q?.trim() ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  // all_text も取得（全文プレビューと検索のため）
  let query = supabase
    .from("fuda_documents" as never)
    .select("id, file_name, occasion, recipient, sender, all_text, ocr_done, ocr_error, ocr_confidence, created_at")
    .order("created_at", { ascending: false });

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `recipient.ilike.${like},sender.ilike.${like},occasion.ilike.${like},all_text.ilike.${like},file_name.ilike.${like}`
    ) as typeof query;
  }

  const { data: docs } = await query as { data: FudaDoc[] | null };
  const rows = docs ?? [];

  // 全文ヒットかどうか（宛名/差出人/用途以外でマッチした場合）
  function isTextHit(doc: FudaDoc): boolean {
    if (!q || !doc.all_text) return false;
    const inMeta =
      doc.recipient?.toLowerCase().includes(q.toLowerCase()) ||
      doc.sender?.toLowerCase().includes(q.toLowerCase()) ||
      doc.occasion?.toLowerCase().includes(q.toLowerCase()) ||
      doc.file_name?.toLowerCase().includes(q.toLowerCase());
    return !inMeta && doc.all_text.toLowerCase().includes(q.toLowerCase());
  }

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">立て札管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            立て札PDFのアップロード・検索・印刷
          </p>
        </div>
        <FudaUploadModal />
      </div>

      {/* 検索バー */}
      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="宛名・差出人・用途・全文で検索..."
          className="input flex-1"
        />
        <button type="submit" className="btn-primary text-sm px-4">
          検索
        </button>
        {q && (
          <a href="/admin/fuda" className="btn-secondary text-sm px-3">
            クリア
          </a>
        )}
      </form>

      {/* 件数 */}
      {q && (
        <p className="text-sm text-gray-500">
          「<span className="font-semibold text-gray-800">{q}</span>」の検索結果：
          <span className="font-semibold text-gray-800 ml-1">{rows.length}</span> 件
        </p>
      )}

      {/* 一覧 */}
      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🌸</div>
          <p className="text-gray-500 text-sm">
            {q ? "条件に一致する立て札が見つかりませんでした" : "まだ立て札が登録されていません"}
          </p>
          {!q && (
            <p className="text-gray-400 text-xs mt-1">
              「+ アップロード」から立て札PDFを追加してください
            </p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-gray-100">
          {rows.map((doc) => {
            const excerpt   = getExcerpt(doc.all_text, q);
            const textHit   = isTextHit(doc);
            const hasContent = doc.recipient || doc.occasion || doc.sender;

            return (
              <Link
                key={doc.id}
                href={`/admin/fuda/${doc.id}`}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-brand-50 transition-colors group"
              >
                {/* ── メインコンテンツ ── */}
                <div className="flex-1 min-w-0 space-y-1">

                  {/* 行1: 用途バッジ + 宛名 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.occasion && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        <Highlight text={doc.occasion} query={q} />
                      </span>
                    )}
                    {doc.recipient ? (
                      <span className="text-sm font-bold text-gray-900 group-hover:text-brand-700">
                        <Highlight text={doc.recipient} query={q} />
                      </span>
                    ) : (
                      !hasContent && (
                        <span className="text-sm font-medium text-gray-400">（宛名なし）</span>
                      )
                    )}
                  </div>

                  {/* 行2: 差出人 */}
                  {doc.sender && (
                    <p className="text-xs text-gray-500">
                      より：<span className="font-medium text-gray-700">
                        <Highlight text={doc.sender} query={q} />
                      </span>
                    </p>
                  )}

                  {/* 行3: 全文プレビュー */}
                  {excerpt && (
                    <p className={`text-xs leading-relaxed ${textHit ? "text-gray-700" : "text-gray-400"}`}>
                      {textHit && (
                        <span className="inline-block bg-yellow-100 text-yellow-700 text-[10px] px-1 py-0.5 rounded mr-1 font-medium">
                          全文一致
                        </span>
                      )}
                      <Highlight text={excerpt} query={q} />
                    </p>
                  )}
                </div>

                {/* ── 右側: 日付・ファイル名・OCR ── */}
                <div className="flex-shrink-0 text-right space-y-1 min-w-[90px]">
                  <p className="text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString("ja-JP", {
                      month: "2-digit", day: "2-digit",
                    })}
                  </p>
                  <p className="text-[11px] text-gray-300 truncate max-w-[110px] ml-auto" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <div className="flex justify-end">
                    <OcrBadge done={doc.ocr_done} error={doc.ocr_error} confidence={doc.ocr_confidence} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
