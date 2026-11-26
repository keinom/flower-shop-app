import { INBOUND_EMAIL_STATUSES } from "@/lib/constants";
import type { InboundEmailStatus } from "@/types";

/**
 * 受信メール一覧の検索条件（URL の status / q / page）。詳細→一覧の戻りでも保持する。
 * status: null は「すべて」。URL に status が無いときの既定は「未対応」（DEFAULT_MAIL_STATUS）。
 */
export interface MailQuery {
  status: InboundEmailStatus | null;
  q: string;
  page: number;
}

/** 一覧を開いたときに既定で表示するステータス */
export const DEFAULT_MAIL_STATUS: InboundEmailStatus = "未対応";
/** 「すべて」を表す URL 上の値（status パラメータ無し＝既定の「未対応」と区別するため） */
export const MAIL_STATUS_ALL = "all";

export function parseMailQuery(raw: { status?: string; q?: string; page?: string }): MailQuery {
  let status: InboundEmailStatus | null;
  if (raw.status === MAIL_STATUS_ALL) {
    status = null;
  } else if ((INBOUND_EMAIL_STATUSES as string[]).includes(raw.status ?? "")) {
    status = raw.status as InboundEmailStatus;
  } else {
    // 未指定・不正値は既定（未対応）
    status = DEFAULT_MAIL_STATUS;
  }
  const page = Math.max(1, Math.min(Number.parseInt(raw.page ?? "1", 10) || 1, 100000));
  return { status, q: (raw.q ?? "").trim().slice(0, 100), page };
}

/** status の URL 上の値（既定の「未対応」は省略して null を返す） */
export function mailStatusParam(status: InboundEmailStatus | null | undefined): string | null {
  if (status === undefined || status === DEFAULT_MAIL_STATUS) return null;
  return status === null ? MAIL_STATUS_ALL : status;
}

export function buildMailQueryString(query: Partial<MailQuery>): string {
  const p = new URLSearchParams();
  const statusParam = mailStatusParam(query.status);
  if (statusParam) p.set("status", statusParam);
  if (query.q) p.set("q", query.q);
  if (query.page && query.page > 1) p.set("page", String(query.page));
  return p.toString();
}

/** `from` パラメータ（詳細から戻る用）を安全な status/q/page だけに再構築する */
export function sanitizeFromParam(from: string | undefined): string {
  if (!from) return "";
  const sp = new URLSearchParams(from);
  return buildMailQueryString(
    parseMailQuery({
      status: sp.get("status") ?? undefined,
      q: sp.get("q") ?? undefined,
      page: sp.get("page") ?? undefined,
    }),
  );
}

/**
 * PostgREST の or() 内で使う ilike 値を作る。
 * LIKE のワイルドカード（% _ \）をエスケープし、PostgREST の予約文字（, ( ) 等）対策で二重引用符で囲む。
 */
export function ilikeOrValue(term: string): string {
  const likeEscaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = likeEscaped.replace(/[\\"]/g, (c) => `\\${c}`);
  return `"%${quoted}%"`;
}
