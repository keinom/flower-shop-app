"use client";

import { useState } from "react";
import { MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/gmail/attachment";

interface Props {
  mailId: string;
  index: number;
  filename: string;
  size: number;
}

/**
 * 添付ダウンロード。サーバー（staff 認証付き Route Handler）が Gmail から都度取得して返す。
 * 失敗しても画面は壊さず、その場にエラー表示する。大きい添付は Gmail で開くよう案内する。
 */
export function MailAttachmentLink({ mailId, index, filename, size }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLarge = size > MAX_ATTACHMENT_BYTES;
  const href = `/api/mail/${mailId}/attachments/${index}`;

  const download = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        let message = "ダウンロードに失敗しました";
        try {
          message = ((await res.json()) as { error?: string }).error ?? message;
        } catch {
          /* JSON でなければ既定文言 */
        }
        setError(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("ダウンロードに失敗しました（通信エラー）");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span aria-hidden>📎</span>
      {tooLarge ? (
        <span className="text-gray-700 break-all">{filename}</span>
      ) : (
        <a href={href} onClick={download} className="text-brand-700 hover:underline break-all" download>
          {busy ? "取得中…" : filename || "(名称なし)"}
        </a>
      )}
      <span className="text-xs text-gray-400">{formatBytes(size)}</span>
      {tooLarge && (
        <span className="text-xs text-amber-700">サイズが大きいため、Gmail で開いてください</span>
      )}
      {error && (
        <span className="text-xs text-red-600" role="alert">{error}</span>
      )}
    </li>
  );
}
