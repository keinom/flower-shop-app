import { INBOUND_EMAIL_STATUSES } from "@/lib/constants";
import type { InboundEmailStatus } from "@/types";

/** 受信メール一覧の検索条件（URL の status / q / page）。詳細→一覧の戻りでも保持する */
export interface MailQuery {
  status: InboundEmailStatus | null;
  q: string;
  page: number;
}

export function parseMailQuery(raw: { status?: string; q?: string; page?: string }): MailQuery {
  const status = (INBOUND_EMAIL_STATUSES as string[]).includes(raw.status ?? "")
    ? (raw.status as InboundEmailStatus)
    : null;
  const page = Math.max(1, Math.min(Number.parseInt(raw.page ?? "1", 10) || 1, 100000));
  return { status, q: (raw.q ?? "").trim().slice(0, 100), page };
}

export function buildMailQueryString(query: Partial<MailQuery>): string {
  const p = new URLSearchParams();
  if (query.status) p.set("status", query.status);
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
