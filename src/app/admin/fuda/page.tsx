import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FudaUploadModal } from "@/components/admin/FudaUploadModal";
import { FudaDeleteButton } from "@/components/admin/FudaDeleteButton";

interface Props {
  searchParams: Promise<{ q?: string; searched?: string }>;
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

// 空白区切りで複数キーワードに分割
function parseKeywords(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

// 最初にヒットしたキーワード位置を起点に前後を抜粋
function getExcerpt(text: string | null, keywords: string[], maxLen = 100): string {
  if (!text) return "";
  const clean = text.replace(/\n+/g, " ").trim();

  if (!keywords.length) {
    return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
  }

  // 最も先頭に近いキーワードの位置を探す
  let firstIdx = -1;
  for (const kw of keywords) {
    const idx = clean.toLowerCase().indexOf(kw.toLowerCase());
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
  }

  const pad   = 20;
  const start = Math.max(0, firstIdx - pad);
  const end   = Math.min(clean.length, firstIdx + maxLen - pad);
  const slice = clean.slice(start, end);
  const tail  = end < clean.length ? "…" : "";
  return slice + tail;
}

// 複数キーワードを全てハイライト（正規表現で一括置換）
function Highlight({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <>{text}</>;

  // 特殊文字エスケープ
  const escaped = keywords.map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  const kwSet = new Set(keywords.map((k) => k.toLowerCase()));

  return (
    <>
      {parts.map((part, i) =>
        kwSet.has(part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// OCR 精度バッジ
function OcrBadge({
  done,
  error,
  confidence,
}: {
  done: boolean;
  error: string | null;
  confidence: string | null;
}) {
  if (!done)
    return (
      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
        OCR処理中
      </span>
    );
  if (error)
    return (
      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
        OCRエラー
      </span>
    );
  const map = {
    high:   "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    low:    "bg-red-100 text-red-600",
  } as const;
  const cls = confidence ? (map[confidence as keyof typeof map] ?? "") : "";
  const lbl =
    confidence === "high"   ? "精度:高" :
    confidence === "medium" ? "精度:中" :
    confidence === "low"    ? "精度:低" : "";
  if (!lbl) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls}`}>
      {lbl}
    </span>
  );
}

// ── ページ ────────────────────────────────────────────
export default async function FudaListPage({ searchParams }: Props) {
  const sp       = await searchParams;
  const q        = sp.q?.trim() ?? "";
  const keywords = parseKeywords(q);
  const searched = sp.searched === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  const isAdmin = profile?.role === "admin";

  // ── 検索ボタンが押された場合のみ DB を叩く ──
  let rows: FudaDoc[] = [];
  if (searched) {
    let query = supabase
      .from("fuda_documents" as never)
      .select(
        "id, file_name, occasion, recipient, sender, all_text, ocr_done, ocr_error, ocr_confidence, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    // キーワードがある場合のみ絞り込む（なければ全件）
    for (const kw of keywords) {
      const like = `%${kw}%`;
      query = query.or(
        `recipient.ilike.${like},sender.ilike.${like},occasion.ilike.${like},all_text.ilike.${like},file_name.ilike.${like}`
      ) as typeof query;
    }

    const { data: docs } = (await query) as { data: FudaDoc[] | null };
    rows = docs ?? [];
  }

  // 全文のみヒット（宛名・差出人・用途・ファイル名以外でマッチ）かどうか
  function isTextOnlyHit(doc: FudaDoc): boolean {
    if (!keywords.length || !doc.all_text) return false;
    // いずれかのキーワードがメタ欄に存在しない → 全文ヒット扱い
    return keywords.some((kw) => {
      const ql = kw.toLowerCase();
      const inMeta =
        doc.recipient?.toLowerCase().includes(ql) ||
        doc.sender?.toLowerCase().includes(ql) ||
        doc.occasion?.toLowerCase().includes(ql) ||
        doc.file_name?.toLowerCase().includes(ql);
      return !inMeta && doc.all_text!.toLowerCase().includes(ql);
    });
  }

  return (
    <div className="space-y-5">

      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">立て札管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">立て札PDFのアップロード・検索・印刷</p>
        </div>
        <FudaUploadModal />
      </div>

      {/* 検索バー */}
      <form method="get" className="flex gap-2">
        <input type="hidden" name="searched" value="1" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="宛名・差出人・用途・全文で検索（スペース区切りでAND検索）"
          className="input flex-1"
        />
        <button type="submit" className="btn-primary text-sm px-4">
          🔍 検索
        </button>
        {searched && (
          <a href="/admin/fuda" className="btn-secondary text-sm px-3">
            クリア
          </a>
        )}
      </form>

      {/* 検索前: 案内（まだ検索ボタンを押していない） */}
      {!searched && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm font-medium">
            「検索」を押すと全件表示、キーワードを入力すると絞り込み検索できます
          </p>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">
            宛名・差出人・用途・全文テキストで検索できます
            <br />
            スペース区切りで複数キーワードのAND検索が可能です
          </p>
        </div>
      )}

      {/* 検索後: 件数バー */}
      {searched && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-bold text-brand-700 text-lg">{rows.length}</span>
          <span>件の立て札</span>
          {keywords.length > 0 && (
            <span className="text-gray-400">
              （
              {keywords.map((kw, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1">AND</span>}
                  「<span className="font-semibold text-gray-700">{kw}</span>」
                </span>
              ))}
              で絞り込み）
            </span>
          )}
          {rows.length >= 200 && (
            <span className="text-xs text-amber-600 ml-1">
              ※ 最大200件まで表示されています。条件を絞り込んでください。
            </span>
          )}
        </div>
      )}

      {/* 検索後: 結果一覧 */}
      {searched && (
        rows.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">🌸</div>
            <p className="text-gray-500 text-sm">
              条件に一致する立て札が見つかりませんでした
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-gray-100">
            {rows.map((doc) => {
              const excerpt     = getExcerpt(doc.all_text, keywords);
              const textOnlyHit = isTextOnlyHit(doc);

              return (
                <div
                  key={doc.id}
                  className="flex items-stretch group hover:bg-brand-50 transition-colors"
                >
                  {/* クリック可能なメインエリア */}
                  <Link
                    href={`/admin/fuda/${doc.id}`}
                    className="flex-1 min-w-0 px-4 py-3"
                  >
                    {/* 行1: ファイル名（左）＋ 日付・精度（右） */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="text-xs text-gray-400 truncate"
                        title={doc.file_name}
                      >
                        <Highlight text={doc.file_name} keywords={keywords} />
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <OcrBadge
                          done={doc.ocr_done}
                          error={doc.ocr_error}
                          confidence={doc.ocr_confidence}
                        />
                        <span className="text-xs text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString("ja-JP", {
                            month: "2-digit",
                            day:   "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* 行2: 用途バッジ ＋ 宛名 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {doc.occasion && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          <Highlight text={doc.occasion} keywords={keywords} />
                        </span>
                      )}
                      {doc.recipient ? (
                        <span className="text-sm font-bold text-gray-900 group-hover:text-brand-700">
                          <Highlight text={doc.recipient} keywords={keywords} />
                        </span>
                      ) : (
                        !doc.occasion && (
                          <span className="text-sm text-gray-400 font-medium">
                            （宛名なし）
                          </span>
                        )
                      )}
                    </div>

                    {/* 行3: 差出人 */}
                    {doc.sender && (
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          差出人
                        </span>
                        <span className="text-xs text-gray-600 font-medium">
                          <Highlight text={doc.sender} keywords={keywords} />
                        </span>
                      </div>
                    )}

                    {/* 行4: 全文プレビュー */}
                    {excerpt && (
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          textOnlyHit ? "text-gray-600" : "text-gray-400"
                        }`}
                      >
                        {textOnlyHit && (
                          <span className="inline-block bg-yellow-100 text-yellow-700 text-[10px] px-1 py-0.5 rounded mr-1 font-medium align-middle">
                            全文一致
                          </span>
                        )}
                        <Highlight text={excerpt} keywords={keywords} />
                      </p>
                    )}
                  </Link>

                  {/* 削除ボタン（管理者のみ） */}
                  {isAdmin && (
                    <div className="flex items-center px-2 flex-shrink-0">
                      <FudaDeleteButton id={doc.id} fileName={doc.file_name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
