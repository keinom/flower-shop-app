/**
 * サニタイズ済み HTML を sandbox iframe の srcDoc にする（クライアントでも使える純粋関数）。
 *
 * iframe 側の前提（MailBodyViewer）: sandbox="allow-popups allow-popups-to-escape-sandbox"
 *   → スクリプト・フォーム送信・同一オリジン扱いはすべて不可。
 * さらに文書内 CSP で、既定では画像を含むあらゆる外部リソースの読み込みを禁止する。
 */
export const REMOTE_IMAGE_ATTR = "data-remote-src";

export function buildSrcDoc(sanitizedHtml: string, allowRemoteImages: boolean): string {
  const imgSrc = allowRemoteImages ? "data: https: http:" : "data:";
  // 退避属性を src に戻すのは <img ...> タグの中の「属性としての出現」だけ。
  // サニタイズ済み HTML では属性値内の " や > はエスケープされているため、alt/title の中身には影響せず、
  // タグの外（本文テキスト）は一切書き換えない。
  const body = allowRemoteImages
    ? sanitizedHtml.replace(/<img\b[^>]*>/gi, (tag) =>
        tag.split(` ${REMOTE_IMAGE_ATTR}="`).join(' src="'),
      )
    : sanitizedHtml;
  const csp = `default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'`;
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<base target="_blank">` +
    `<style>html,body{margin:0}body{padding:12px;font:14px/1.7 -apple-system,'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif;color:#1f2937;word-break:break-word;overflow-wrap:anywhere}` +
    `img{max-width:100%;height:auto}table{max-width:100%}a{color:#2e7458}pre{white-space:pre-wrap}blockquote{margin:0 0 0 .5em;padding-left:.8em;border-left:3px solid #d1d5db;color:#4b5563}</style>` +
    `</head><body>${body}</body></html>`
  );
}
