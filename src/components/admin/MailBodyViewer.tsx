"use client";

import { useMemo, useState } from "react";
import { buildSrcDoc } from "@/lib/gmail/viewer";

interface Props {
  /** サーバーでサニタイズ済みの HTML（無ければ null = テキストのみのメール） */
  sanitizedHtml: string | null;
  /** テキスト本文（HTML しか無いメールはサーバーで HTML から生成済み） */
  text: string;
  hasRemoteImages: boolean;
}

/**
 * メール本文ビューア。
 * - HTML は sandbox 付き iframe（allow-scripts / allow-same-origin なし）で表示。
 *   アプリ本体の DOM には dangerouslySetInnerHTML で差し込まない。
 * - 外部画像は既定でブロック。「画像を表示」を押したこのメールだけ許可（開封トラッキング対策）。
 * - テキスト本文は React のテキストとして描画（エスケープ済み）。
 */
export function MailBodyViewer({ sanitizedHtml, text, hasRemoteImages }: Props) {
  const [mode, setMode] = useState<"html" | "text">(sanitizedHtml ? "html" : "text");
  const [showImages, setShowImages] = useState(false);

  const srcDoc = useMemo(
    () => (sanitizedHtml ? buildSrcDoc(sanitizedHtml, showImages) : ""),
    [sanitizedHtml, showImages],
  );

  return (
    <div className="space-y-2">
      {sanitizedHtml && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {(["html", "text"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 ${
                  mode === m ? "bg-brand-600 text-white font-semibold" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m === "html" ? "HTML表示" : "テキスト表示"}
              </button>
            ))}
          </div>
          {mode === "html" && hasRemoteImages && !showImages && (
            <>
              <span className="text-gray-500">外部画像はブロックしています（開封の追跡を防ぐため）</span>
              <button type="button" className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setShowImages(true)}>
                画像を表示
              </button>
            </>
          )}
          {mode === "html" && showImages && (
            <>
              <span className="text-amber-700">このメールの外部画像を表示中</span>
              <button type="button" className="btn-ghost !py-1 !px-3 text-xs" onClick={() => setShowImages(false)}>
                再びブロック
              </button>
            </>
          )}
        </div>
      )}

      {sanitizedHtml && mode === "html" ? (
        <iframe
          title="メール本文"
          // スクリプト・フォーム送信・同一オリジン扱いはすべて不可。リンクを新しいタブで開くためだけ popups を許可
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={srcDoc}
          className="w-full h-[60vh] min-h-[320px] border border-gray-200 rounded-lg bg-white"
        />
      ) : (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-sans text-gray-800 border border-gray-200 rounded-lg bg-white p-3">
          {text || "（本文なし）"}
        </pre>
      )}
    </div>
  );
}
