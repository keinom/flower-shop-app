/**
 * 添付ダウンロード用の純粋ヘルパ（クライアントでも使える）。
 */

/** Vercel の関数レスポンス上限（約 4.5MB）に収まる上限。超える添付は Gmail で開いてもらう */
export const MAX_ATTACHMENT_BYTES = 4_000_000;

/** パス区切り・制御文字・引用符などを除去し、ダウンロード名として安全な文字列にする */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u0080-\u009f]/g, "")
    .replace(/[\\/:*?"<>|\u202a-\u202e\u2066-\u2069]/g, "_") // パス区切り・予約文字・双方向制御文字
    .replace(/^\.+/, "") // 隠しファイル・".." 化の防止
    .trim()
    .slice(0, 180);
  return cleaned || "attachment";
}

/** RFC 5987 形式（日本語対応）の Content-Disposition。常に attachment */
export function contentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/[%;"\\]/g, "_");
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
