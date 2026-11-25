/**
 * Gmail API (format=full) のメッセージを、文字コードを解決した ParsedMail に変換する。
 * 純粋関数のみ（ネットワーク・環境変数に依存しない）。
 *
 * 対応: multipart/alternative・mixed・related の入れ子、ISO-2022-JP / Shift_JIS / EUC-JP / UTF-8、
 *       RFC 2047 エンコード語（件名・送信者名・ファイル名）。
 *       Content-Transfer-Encoding（base64 / quoted-printable）は Gmail API がデコード済みの body.data を返す。
 */
import type {
  GmailApiMessage,
  GmailHeader,
  GmailMessagePart,
  ParsedAttachment,
  ParsedMail,
} from "./types";

/** 1 本文あたりの保存上限（巨大メールで DB・画面を重くしない） */
const MAX_BODY_CHARS = 1_000_000;

/** PostgreSQL の text は NUL を保持できないため除去する */
function clean(s: string): string {
  return s.replace(/\u0000/g, "");
}

export function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** charset 名に従ってデコード。未知の charset は UTF-8 にフォールバック */
export function decodeCharset(buf: Buffer, charset: string | undefined): string {
  const label = (charset ?? "utf-8").trim().replace(/^"|"$/g, "").toLowerCase();
  try {
    return new TextDecoder(label || "utf-8").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

function decodeQuotedPrintableWord(s: string): Buffer {
  const bytes: number[] = [];
  const str = s.replace(/_/g, " ");
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "=" && /^[0-9a-fA-F]{2}$/.test(str.slice(i + 1, i + 3))) {
      bytes.push(parseInt(str.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(str.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

const ENCODED_WORD = /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g;

/** RFC 2047 のエンコード語（=?charset?B?...?=）を含むヘッダ値をデコード */
export function decodeMimeWords(input: string): string {
  if (!input || !input.includes("=?")) return input ?? "";
  // 隣接するエンコード語（間の空白は無視）で同一 charset/encoding のものはバイト列を連結してからデコードする
  // （ISO-2022-JP のエスケープシーケンスや、語の分割位置による文字化けを防ぐ）
  type Tok = { text?: string; charset?: string; enc?: string; bytes?: Buffer };
  const toks: Tok[] = [];
  let last = 0;
  for (const m of input.matchAll(ENCODED_WORD)) {
    const idx = m.index ?? 0;
    const between = input.slice(last, idx);
    const prev = toks[toks.length - 1];
    if (between && !(prev?.bytes && /^\s+$/.test(between))) toks.push({ text: between });
    const charset = m[1].split("*")[0].toLowerCase();
    const enc = m[2].toUpperCase();
    const bytes =
      enc === "B" ? Buffer.from(m[3], "base64") : decodeQuotedPrintableWord(m[3]);
    const p = toks[toks.length - 1];
    if (p?.bytes && p.charset === charset && p.enc === enc) {
      p.bytes = Buffer.concat([p.bytes, bytes]);
    } else {
      toks.push({ charset, enc, bytes });
    }
    last = idx + m[0].length;
  }
  if (last < input.length) toks.push({ text: input.slice(last) });
  return toks
    .map((t) => (t.bytes ? decodeCharset(t.bytes, t.charset) : (t.text ?? "")))
    .join("");
}

function header(headers: GmailHeader[] | undefined, name: string): string | null {
  const n = name.toLowerCase();
  const h = headers?.find((x) => x.name.toLowerCase() === n);
  return h ? h.value : null;
}

/** `text/html; charset="ISO-2022-JP"` → { mime, params } */
function parseContentType(v: string | null): { mime: string; params: Record<string, string> } {
  if (!v) return { mime: "", params: {} };
  const [first, ...rest] = v.split(";");
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    params[p.slice(0, eq).trim().toLowerCase()] = p
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
  return { mime: first.trim().toLowerCase(), params };
}

export interface Address {
  name: string | null;
  address: string;
}

/** "Name" <a@b>, Name2 <c@d>, e@f 形式のリストを分解（引用符・山括弧・コメント内のカンマを考慮） */
export function parseAddressList(value: string | null): Address[] {
  if (!value) return [];
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  let angle = 0;
  let paren = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\\" && inQuote) {
      cur += ch + (value[++i] ?? "");
      continue;
    }
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote) {
      if (ch === "<") angle++;
      else if (ch === ">") angle = Math.max(0, angle - 1);
      else if (ch === "(") paren++;
      else if (ch === ")") paren = Math.max(0, paren - 1);
      else if (ch === "," && angle === 0 && paren === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  const out: Address[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    const angleM = p.match(/<([^<>]*)>\s*$/);
    let address = "";
    let name = "";
    if (angleM) {
      address = angleM[1].trim();
      name = p.slice(0, angleM.index).trim();
    } else {
      const bare = p.match(/[^\s<>(),;:"]+@[^\s<>(),;:"]+/);
      address = bare ? bare[0] : "";
      name = bare ? p.replace(bare[0], "").trim() : p;
    }
    name = name.replace(/^"((?:[^"\\]|\\.)*)"$/, (_m, g: string) => g.replace(/\\(.)/g, "$1")).trim();
    name = decodeMimeWords(name).trim();
    if (!address.includes("@") && !name) continue;
    out.push({ name: name || null, address: address.trim() });
  }
  return out;
}

/** Gmail の snippet は HTML エンティティでエスケープされて返るため戻す */
function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_m, g: string) => {
    if (g[0] === "#") {
      const cp = g[1] === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : "";
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "\x27" } as Record<string, string>)[g] ?? "";
  });
}

function isAttachmentPart(part: GmailMessagePart): boolean {
  const filename = decodeMimeWords(part.filename ?? "").trim();
  return filename !== "" && !!(part.body?.attachmentId || part.body?.data !== undefined);
}

export function flattenParts(part: GmailMessagePart | undefined, acc: GmailMessagePart[] = []): GmailMessagePart[] {
  if (!part) return acc;
  acc.push(part);
  for (const c of part.parts ?? []) flattenParts(c, acc);
  return acc;
}

/** ダウンロード時にパート識別子（part_id）から現在のパートを取り直す */
export function findPartById(msg: GmailApiMessage, partId: string): GmailMessagePart | null {
  return flattenParts(msg.payload).find((p) => (p.partId ?? "") === partId && isAttachmentPart(p)) ?? null;
}

function decodePartText(part: GmailMessagePart): string {
  const data = part.body?.data;
  if (!data) return "";
  const { params } = parseContentType(header(part.headers, "Content-Type"));
  return decodeCharset(decodeBase64Url(data), params["charset"]);
}

export function parseGmailMessage(msg: GmailApiMessage): ParsedMail {
  const payload = msg.payload;
  const headers = payload?.headers;

  const from = parseAddressList(header(headers, "From"))[0];
  const fromAddress = (from?.address ?? "").trim().toLowerCase();

  const textParts: string[] = [];
  const htmlParts: string[] = [];
  const attachments: ParsedAttachment[] = [];

  for (const part of flattenParts(payload)) {
    if (part.parts && part.parts.length > 0) continue; // multipart コンテナ自体は対象外
    if (isAttachmentPart(part)) {
      attachments.push({
        filename: clean(decodeMimeWords(part.filename ?? "").trim()),
        mime_type: (parseContentType(header(part.headers, "Content-Type")).mime || part.mimeType || "application/octet-stream").slice(0, 200),
        size: part.body?.size ?? 0,
        part_id: part.partId ?? "",
      });
      continue;
    }
    const mime = (part.mimeType ?? parseContentType(header(part.headers, "Content-Type")).mime).toLowerCase();
    if (mime === "text/plain") textParts.push(decodePartText(part));
    else if (mime === "text/html") htmlParts.push(decodePartText(part));
  }

  const bodyText = textParts.length ? clean(textParts.join("\n\n")).slice(0, MAX_BODY_CHARS) : null;
  const bodyHtml = htmlParts.length ? clean(htmlParts.join("\n")).slice(0, MAX_BODY_CHARS) : null;

  const internal = Number(msg.internalDate);
  let receivedAt = Number.isFinite(internal) && internal > 0 ? new Date(internal) : new Date(NaN);
  if (isNaN(receivedAt.getTime())) {
    const d = new Date(header(headers, "Date") ?? "");
    receivedAt = isNaN(d.getTime()) ? new Date() : d;
  }

  // To / Cc / Reply-To は元のヘッダ表記（引用符・区切り）を保ったままエンコード語だけ復号して保存する
  const rawList = (name: string) => {
    const v = header(headers, name);
    return v ? clean(decodeMimeWords(v)).replace(/\s+/g, " ").trim() || null : null;
  };

  return {
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId,
    labelIds: msg.labelIds ?? [],
    messageIdHeader: header(headers, "Message-ID") ?? header(headers, "Message-Id"),
    referencesHeader: header(headers, "References"),
    replyTo: rawList("Reply-To"),
    fromName: from?.name ? clean(from.name) : null,
    fromAddress: clean(fromAddress),
    to: rawList("To"),
    cc: rawList("Cc"),
    subject: clean(decodeMimeWords(header(headers, "Subject") ?? "")).trim(),
    snippet: msg.snippet ? decodeHtmlEntities(clean(msg.snippet)) : null,
    bodyText,
    bodyHtml,
    receivedAt: receivedAt.toISOString(),
    attachments,
  };
}
