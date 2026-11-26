/**
 * 本文ビューア（sandbox iframe + CSP + サニタイズ）のブラウザ実行検証用ハーネス。
 *
 *   npx tsx --conditions=react-server scripts/verify-mail-viewer.ts
 *   → http://127.0.0.1:4588/ をブラウザで開く。計測サーバー（同ポート）が受けたリクエストを /hits で確認できる。
 *
 * 悪意あるフィクスチャ HTML 内の外部ホスト（*.example.invalid）を計測サーバーに差し替え、
 *   A) サニタイズ済み・画像ブロック   B) サニタイズ済み・「画像を表示」後   C) 生 HTML（サニタイズなし）を sandbox のみで表示
 * の 3 つの iframe を並べる。A/C では /script-ran・/onerror・/tracker などへのリクエストが 0 件であること、
 * B では画像だけが取得されることを確認する。
 */
import http from "node:http";
import { FixtureGmailClient } from "../src/lib/gmail/fixtures";
import { parseGmailMessage } from "../src/lib/gmail/mime";
import { prepareHtmlForViewer } from "../src/lib/gmail/html";
import { buildSrcDoc } from "../src/lib/gmail/viewer";

const PORT = 4588;
// ブラウザペインはサンドボックス iframe からのループバック宛リクエストを遮断するため、観測用に公開ホストの URL 接頭辞を使う（GET のみ・応答内容は使わない）
const ORIGIN = process.env.PROBE_ORIGIN ?? `http://127.0.0.1:${PORT}`;
const hits: string[] = [];

const client = new FixtureGmailClient();
let html = parseGmailMessage(client.peek("fx-0004")).bodyHtml!;
html = html
  .replace("<script>document.title='pwned';", `<script>fetch('${ORIGIN}/script-ran');document.title='pwned';`)
  .replace(`onerror="alert('xss-onerror')"`, `onerror="fetch('${ORIGIN}/onerror')"`)
  .replace(/https:\/\/tracker\.example\.invalid\/open\.gif\?u=1/, `${ORIGIN}/tracker-img.gif`)
  .replace(/https:\/\/tracker\.example\.invalid\/css-bg\.gif/, `${ORIGIN}/css-bg.gif`)
  .replace(/https:\/\/tracker\.example\.invalid\/bg\.gif/, `${ORIGIN}/inline-bg.gif`)
  .replace(/https:\/\/evil\.example\.invalid\/frame/, `${ORIGIN}/iframe-src`)
  .replace(/https:\/\/evil\.example\.invalid\/steal/, `${ORIGIN}/form-action`)
  .replace(/https:\/\/evil\.example\.invalid\//, `${ORIGIN}/meta-refresh`);

const view = prepareHtmlForViewer(html);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

const rawDoc = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;

const page = `<!doctype html><html><head><meta charset="utf-8"><title>viewer check</title></head><body style="font-family:sans-serif">
<h3>A) サニタイズ済み・画像ブロック</h3>
<iframe id="a" sandbox="${SANDBOX}" srcdoc="${esc(buildSrcDoc(view.html, false))}" style="width:100%;height:260px"></iframe>
<h3>B) サニタイズ済み・画像を表示</h3>
<iframe id="b" sandbox="${SANDBOX}" srcdoc="${esc(buildSrcDoc(view.html, true))}" style="width:100%;height:260px"></iframe>
<h3>C) 生 HTML を sandbox のみで表示（多層防御の確認）</h3>
<iframe id="c" sandbox="${SANDBOX}" srcdoc="${esc(rawDoc)}" style="width:100%;height:260px"></iframe>
<p id="parent-title">parent title: <span id="t"></span></p>
<script>document.getElementById('t').textContent = document.title;</script>
</body></html>`;

// 観測用: 同じ srcdoc を sandbox 属性なし（同一オリジン）で開く。サニタイズ後は実行されるスクリプトが無いこと、
// CSP が画像をブロック／許可すること、生 HTML（対照）ではスクリプトが走ること（= 検出系が機能していること）を確認する
const probeDocs: Record<string, string> = {
  a: buildSrcDoc(view.html, false),
  b: buildSrcDoc(view.html, true),
  c: rawDoc,
};
const probe = (k: string) => `<!doctype html><html><body><iframe id="f" srcdoc="${esc(probeDocs[k] ?? "")}"></iframe></body></html>`;

http
  .createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(page);
    }
    if (url.startsWith("/probe/")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(probe(url.slice(7)));
    }
    if (url === "/hits") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(hits));
    }
    if (url === "/reset") {
      hits.length = 0;
      return res.end("ok");
    }
    hits.push(url);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/gif");
    res.end(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
  })
  .listen(PORT, "127.0.0.1", () => console.log(`listening ${ORIGIN}`));
