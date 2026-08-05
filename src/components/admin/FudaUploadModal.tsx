"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadFudaPdf } from "@/app/admin/fuda/actions";

// ── 型 ──────────────────────────────────────────────
type UploadMode = "single" | "bulk";
type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  file:    File;
  status:  FileStatus;
  message: string;
  id:      string | undefined;
}

// ── コンポーネント ───────────────────────────────────
export function FudaUploadModal() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open,      setOpen]      = useState(false);
  const [mode,      setMode]      = useState<UploadMode>("single");
  const [entries,   setEntries]   = useState<FileEntry[]>([]);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── ヘルパー ─────────────────────────────────────
  const reset = useCallback(() => {
    setEntries([]);
    setDragging(false);
    setUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    reset();
    setMode("single");
  }, [reset]);

  const addFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (!pdfs.length) return;

      if (mode === "single") {
        // 通常モードは最新1ファイルのみ
        setEntries([{ file: pdfs[0], status: "pending", message: "", id: undefined }]);
      } else {
        // 一括モードは追加
        setEntries((prev) => [
          ...prev,
          ...pdfs.map((f) => ({ file: f, status: "pending" as FileStatus, message: "", id: undefined })),
        ]);
      }
    },
    [mode]
  );

  const removeEntry = useCallback((idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Drag & Drop ─────────────────────────────────
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = ()                    => setDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── アップロード実行 ─────────────────────────────
  const handleUpload = async () => {
    if (!entries.length || uploading) return;
    setUploading(true);

    if (mode === "single") {
      // 通常: 1ファイル → アップロード → 詳細ページへ
      setEntries((prev) =>
        prev.map((e, i) => (i === 0 ? { ...e, status: "uploading", message: "アップロード＋OCR処理中..." } : e))
      );
      const fd = new FormData();
      fd.append("file", entries[0].file);
      const result = await uploadFudaPdf(fd);

      if (result.error) {
        setEntries((prev) =>
          prev.map((e, i) => (i === 0 ? { ...e, status: "error", message: result.error! } : e))
        );
        setUploading(false);
      } else {
        setEntries((prev) =>
          prev.map((e, i) => (i === 0 ? { ...e, status: "done", message: "完了", id: result.id } : e))
        );
        setUploading(false);
        setOpen(false);
        reset();
        router.push(`/admin/fuda/${result.id}`);
      }
    } else {
      // 一括: 全ファイルを順に処理
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].status !== "pending") continue;

        setEntries((prev) =>
          prev.map((e, idx) =>
            idx === i ? { ...e, status: "uploading", message: "アップロード＋OCR処理中..." } : e
          )
        );

        const fd = new FormData();
        fd.append("file", entries[i].file);
        const result = await uploadFudaPdf(fd);

        setEntries((prev) =>
          prev.map((e, idx) =>
            idx === i
              ? result.error
                ? { ...e, status: "error",  message: result.error }
                : { ...e, status: "done",   message: "完了", id: result.id }
              : e
          )
        );
      }
      setUploading(false);
      router.refresh();
    }
  };

  // ── 派生状態 ─────────────────────────────────────
  const allDone     = entries.length > 0 && entries.every((e) => e.status === "done" || e.status === "error");
  const doneCount   = entries.filter((e) => e.status === "done").length;
  const errorCount  = entries.filter((e) => e.status === "error").length;
  const hasUploadable = entries.some((e) => e.status === "pending");

  // ── アイコン ──────────────────────────────────────
  const statusIcon = (s: FileStatus) =>
    s === "done"      ? "✅" :
    s === "error"     ? "❌" :
    s === "uploading" ? "⏳" : "📄";

  // ── レンダリング ─────────────────────────────────
  return (
    <>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-sm"
      >
        + アップロード
      </button>

      {!open ? null : (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={handleClose}
          />

          {/* モーダル */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

              {/* ヘッダー */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-base font-bold text-gray-900">立て札PDFアップロード</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="3" x2="13" y2="13" />
                    <line x1="13" y1="3" x2="3"  y2="13" />
                  </svg>
                </button>
              </div>

              {/* モード切替タブ */}
              <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
                {(["single", "bulk"] as UploadMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { if (!uploading) { setMode(m); reset(); } }}
                    disabled={uploading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      mode === m
                        ? "bg-brand-700 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {m === "single" ? "通常アップロード" : "一括アップロード"}
                  </button>
                ))}
              </div>

              {/* モード説明 */}
              <p className="px-5 pt-2 text-xs text-gray-400 flex-shrink-0">
                {mode === "single"
                  ? "1ファイルをアップロードし、OCR結果を確認できます。"
                  : "複数のPDFを一度に選択してまとめてアップロードします。"}
              </p>

              {/* ボディ */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* ドロップゾーン（完了前のみ表示） */}
                {!uploading && !(allDone && mode === "bulk") && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
                      dragging
                        ? "border-brand-500 bg-brand-50 scale-[1.01]"
                        : "border-gray-300 hover:border-brand-400 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-4xl mb-2 select-none">📄</div>
                    <p className="text-sm font-semibold text-gray-700">
                      {mode === "bulk"
                        ? "複数のPDFをドロップ"
                        : "PDFをここにドロップ"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      またはクリックしてファイルを選択
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple={mode === "bulk"}
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                )}

                {/* ファイルリスト */}
                {entries.length > 0 && (
                  <div className="space-y-2">
                    {entries.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <span className="text-xl mt-0.5 flex-shrink-0">
                          {statusIcon(entry.status)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {entry.file.name}
                          </p>
                          <p className={`text-xs mt-0.5 ${
                            entry.status === "error"     ? "text-red-600" :
                            entry.status === "uploading" ? "text-blue-600" :
                            entry.status === "done"      ? "text-green-600" :
                            "text-gray-400"
                          }`}>
                            {entry.status === "pending"   && `${(entry.file.size / 1024).toFixed(0)} KB`}
                            {entry.status === "uploading" && entry.message}
                            {entry.status === "done"      && entry.message}
                            {entry.status === "error"     && entry.message}
                          </p>
                        </div>
                        {entry.status === "pending" && !uploading && (
                          <button
                            type="button"
                            onClick={() => removeEntry(i)}
                            className="text-gray-300 hover:text-red-400 text-xs px-1.5 py-0.5 flex-shrink-0 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 一括完了メッセージ */}
                {allDone && mode === "bulk" && (
                  <div className={`p-3 rounded-lg text-sm text-center border ${
                    errorCount > 0
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-green-50 border-green-200 text-green-700"
                  }`}>
                    <span className="font-semibold">{doneCount}件</span> アップロード完了
                    {errorCount > 0 && (
                      <span className="text-red-600 ml-2">（{errorCount}件 失敗）</span>
                    )}
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
                {allDone ? (
                  <button type="button" onClick={handleClose} className="btn-primary text-sm">
                    閉じる
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-secondary text-sm"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={!hasUploadable || uploading}
                      className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploading && (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                      )}
                      {uploading ? "処理中..." : "アップロード開始"}
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
