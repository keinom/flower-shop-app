"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rerunFudaOcr, deleteFudaDocument } from "@/app/admin/fuda/actions";

interface Props {
  id:        string;
  pdfUrl:    string;
  isAdmin:   boolean;
  fileName:  string;
  occasion:  string | null;
  recipient: string | null;
  sender:    string | null;
  allText:   string | null;
  confidence: string | null;
  ocrError:  string | null;
  createdAt: string;
}

// 信頼度バッジ
function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  const map = {
    high:   { label: "高（high）",   cls: "bg-green-100 text-green-700 border-green-200" },
    medium: { label: "中（medium）", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    low:    { label: "低（low）",    cls: "bg-red-100 text-red-700 border-red-200" },
  } as const;
  const item = confidence ? map[confidence as keyof typeof map] : null;
  if (!item) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${item.cls}`}>
      {item.label}
    </span>
  );
}

// 情報行
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 break-words">
        {value ?? <span className="text-gray-300 font-normal">—（記載なし）</span>}
      </dd>
    </div>
  );
}

export function FudaDetailClient({
  id, pdfUrl, isAdmin, fileName,
  occasion, recipient, sender, allText,
  confidence, ocrError, createdAt,
}: Props) {
  const router = useRouter();

  const [isPendingOcr, startOcr]    = useTransition();
  const [isPendingDel, startDelete] = useTransition();
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  // OCR 再実行
  const handleRerunOcr = () => {
    setErrorMsg(null);
    startOcr(async () => {
      const res = await rerunFudaOcr(id);
      if (res.error) setErrorMsg(res.error);
    });
  };

  // 削除
  const handleDelete = () => {
    if (!confirm(`「${fileName}」を削除しますか？\nこの操作は元に戻せません。`)) return;
    setErrorMsg(null);
    startDelete(async () => {
      const res = await deleteFudaDocument(id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.push("/admin/fuda");
      }
    });
  };

  // PDF を新タブで開いて印刷
  const handlePrint = () => window.open(pdfUrl, "_blank");

  return (
    <div className="space-y-5">

      {/* エラー表示 */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {ocrError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
          <p className="font-semibold mb-1">⚠️ OCR エラー</p>
          <p className="text-xs">{ocrError}</p>
        </div>
      )}

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ── 左: OCR 結果パネル ── */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">OCR 読み取り結果</h2>

            <dl className="space-y-3">
              <InfoRow label="用途・祝い事" value={occasion} />
              <InfoRow label="宛名（受取人）" value={recipient} />
              <InfoRow label="差出人" value={sender} />
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">読み取り精度</dt>
                <dd><ConfidenceBadge confidence={confidence} /></dd>
              </div>
            </dl>

            {allText && (
              <div>
                <dt className="text-xs text-gray-400 mb-1">全テキスト</dt>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 whitespace-pre-wrap leading-relaxed text-gray-700 font-sans">
                  {allText}
                </pre>
              </div>
            )}
          </div>

          {/* メタ情報 */}
          <div className="card p-4 space-y-2 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>ファイル名</span>
              <span className="font-medium text-gray-700 truncate ml-2 max-w-[180px]">{fileName}</span>
            </div>
            <div className="flex justify-between">
              <span>登録日時</span>
              <span className="font-medium text-gray-700">
                {new Date(createdAt).toLocaleString("ja-JP", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              🖨 印刷（新タブで開く）
            </button>
            <button
              type="button"
              onClick={handleRerunOcr}
              disabled={isPendingOcr || isPendingDel}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {isPendingOcr ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  OCR 処理中...
                </>
              ) : "🔄 OCR 再実行"}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPendingOcr || isPendingDel}
                className="w-full text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isPendingDel ? "削除中..." : "🗑 削除"}
              </button>
            )}
          </div>
        </div>

        {/* ── 右: PDF プレビュー ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 truncate">{fileName}</p>
            <button
              type="button"
              onClick={handlePrint}
              className="text-xs text-brand-700 hover:underline flex-shrink-0 ml-2"
            >
              新タブで開く ↗
            </button>
          </div>
          <div
            style={{ height: "min(80vh, 900px)" }}
            className="w-full bg-gray-100"
          >
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={fileName}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
