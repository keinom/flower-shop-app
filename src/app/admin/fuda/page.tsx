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
  ocr_done:       boolean;
  ocr_error:      string | null;
  ocr_confidence: string | null;
  created_at:     string;
}

// 信頼度バッジ
function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const map = {
    high:   { label: "高",   cls: "bg-green-100 text-green-700" },
    medium: { label: "中",   cls: "bg-amber-100 text-amber-700" },
    low:    { label: "低",   cls: "bg-red-100 text-red-700" },
  } as const;
  const item = map[confidence as keyof typeof map];
  if (!item) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.cls}`}>
      精度:{item.label}
    </span>
  );
}

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

  // 検索クエリ構築
  let query = supabase
    .from("fuda_documents" as never)
    .select("id, file_name, occasion, recipient, sender, ocr_done, ocr_error, ocr_confidence, created_at")
    .order("created_at", { ascending: false });

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `recipient.ilike.${like},sender.ilike.${like},occasion.ilike.${like},all_text.ilike.${like},file_name.ilike.${like}`
    ) as typeof query;
  }

  const { data: docs } = await query as { data: FudaDoc[] | null };
  const rows = docs ?? [];

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
          placeholder="宛名・差出人・用途・ファイル名で検索..."
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
          <span className="font-semibold">{rows.length}</span> 件
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
        <div className="card overflow-hidden">
          {/* テーブルヘッダー（デスクトップ） */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div>ファイル名 / 用途</div>
            <div className="w-32">宛名</div>
            <div className="w-28">差出人</div>
            <div className="w-20 text-center">OCR</div>
            <div className="w-20 text-right">登録日</div>
          </div>

          <div className="divide-y divide-gray-100">
            {rows.map((doc) => (
              <Link
                key={doc.id}
                href={`/admin/fuda/${doc.id}`}
                className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-1 sm:gap-4 sm:items-center px-4 py-3 hover:bg-brand-50 transition-colors group"
              >
                {/* ファイル名 + 用途 */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-brand-700">
                    {doc.file_name}
                  </p>
                  {doc.occasion && (
                    <span className="inline-block mt-0.5 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      {doc.occasion}
                    </span>
                  )}
                </div>

                {/* 宛名 */}
                <div className="w-32 text-sm text-gray-700 truncate">
                  {doc.recipient ?? <span className="text-gray-300">—</span>}
                </div>

                {/* 差出人 */}
                <div className="w-28 text-sm text-gray-500 truncate">
                  {doc.sender ?? <span className="text-gray-300">—</span>}
                </div>

                {/* OCR ステータス */}
                <div className="w-20 flex items-center justify-start sm:justify-center gap-1">
                  {!doc.ocr_done ? (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">処理中</span>
                  ) : doc.ocr_error ? (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded" title={doc.ocr_error}>
                      エラー
                    </span>
                  ) : (
                    <ConfidenceBadge confidence={doc.ocr_confidence} />
                  )}
                </div>

                {/* 登録日 */}
                <div className="w-20 text-xs text-gray-400 text-right">
                  {new Date(doc.created_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
