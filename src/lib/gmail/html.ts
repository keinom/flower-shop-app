import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * 受信メール HTML の無害化（信頼できない入力として扱う）。
 *
 * 多層防御の 1 層目（サーバー側サニタイズ）。2 層目以降は表示側:
 *   - sandbox 属性付き iframe（allow-scripts / allow-same-origin なし）
 *   - iframe 内 CSP（default-src 'none'・画像は既定ブロック）
 * アプリ本体の DOM に dangerouslySetInnerHTML で差し込むことはしない。
 *
 * 除去するもの: script / style / iframe / object / embed / form / input / meta / link / base / svg /
 *   イベントハンドラ属性 / javascript: 等の URL / style 内の url()・expression 等。
 * 外部画像（http/https）は src を取り除いて data-remote-src に退避し、
 * 「画像を表示」操作のときだけクライアントが src に戻す（既定ではリクエストされない）。
 */

const NON_TEXT_TAGS = [
  "script", "style", "textarea", "option", "noscript", "title",
  "svg", "math", "iframe", "object", "embed", "template", "head",
];

const SAFE_STYLE_VALUE = [/^(?!.*(url\s*\(|expression|javascript|@import|behavior|-moz-binding)).*$/i];
const STYLE_PROPS = [
  "color", "background-color", "font-size", "font-weight", "font-family", "font-style",
  "text-align", "text-decoration", "line-height", "vertical-align", "white-space",
  "width", "height", "max-width", "min-width",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-style", "border-width", "border-collapse", "border-radius",
];

const ALLOWED_STYLES: Record<string, RegExp[]> = Object.fromEntries(
  STYLE_PROPS.map((p) => [p, SAFE_STYLE_VALUE]),
);

import { REMOTE_IMAGE_ATTR } from "./viewer";

export interface ViewerHtml {
  /** サニタイズ済みの本文 HTML（<body> 内に入れる断片） */
  html: string;
  /** 外部画像が含まれる（「画像を表示」を出すかの判定用） */
  hasRemoteImages: boolean;
}

export function prepareHtmlForViewer(rawHtml: string): ViewerHtml {
  let hasRemoteImages = false;

  const html = sanitizeHtml(rawHtml, {
    allowedTags: [
      "a", "abbr", "b", "blockquote", "br", "caption", "center", "code", "col", "colgroup",
      "dd", "div", "dl", "dt", "em", "font", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i",
      "img", "li", "ol", "p", "pre", "s", "small", "span", "strike", "strong", "sub", "sup",
      "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
    ],
    allowedAttributes: {
      a: ["href", "name", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", REMOTE_IMAGE_ATTR],
      font: ["color", "face", "size"],
      td: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor"],
      th: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor"],
      table: ["border", "cellpadding", "cellspacing", "align", "width", "bgcolor"],
      "*": ["style", "dir", "lang"],
    },
    allowedStyles: { "*": ALLOWED_STYLES },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    nonTextTags: NON_TEXT_TAGS,
    transformTags: {
      a: (tagName, attribs) => {
        const next: Record<string, string> = { ...attribs, target: "_blank", rel: "noopener noreferrer" };
        // 絶対の http(s) / mailto のみ許可。相対 URL（/admin/... 等）・#fragment・tel: などは href を落とす
        if (!/^\s*(https?:\/\/|mailto:)/i.test(next.href ?? "")) delete next.href;
        return { tagName, attribs: next };
      },
      img: (tagName, attribs) => {
        const next = { ...attribs };
        const src = (next.src ?? "").trim();
        delete next[REMOTE_IMAGE_ATTR]; // 送信者が同名属性を仕込んでも無効化
        if (/^https?:\/\//i.test(src)) {
          hasRemoteImages = true;
          delete next.src;
          next[REMOTE_IMAGE_ATTR] = src;
        } else if (!/^data:image\/(png|gif|jpe?g|webp);base64,/i.test(src)) {
          delete next.src; // cid: やその他のスキームは表示しない
        }
        return { tagName, attribs: next };
      },
    },
    // 外部画像の URL に使えるスキームは transformTags で http(s) に限定済み。退避属性は検証対象外にする
    allowedSchemesAppliedToAttributes: ["href", "src"],
  });

  return { html, hasRemoteImages };
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

/** 「テキスト表示」用: HTML をタグ除去して読みやすいプレーンテキストにする（React で素のテキストとして描画） */
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, "\n");
  const stripped = sanitizeHtml(withBreaks, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: NON_TEXT_TAGS,
  });
  return stripped
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
