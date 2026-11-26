import { NextRequest, NextResponse } from "next/server";
import { getStaffOrNull } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient, isGmailConfigured, GmailError, GMAIL_ERROR_MESSAGES } from "@/lib/gmail";
import { findPartById, decodeBase64Url } from "@/lib/gmail/mime";
import { MAX_ATTACHMENT_BYTES, contentDisposition } from "@/lib/gmail/attachment";
import type { InboundEmailAttachment } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/**
 * 添付ファイルのダウンロード（実体は保存せず、Gmail から都度取得して返す）。
 *
 * - /api 配下は middleware のロール制御対象外 → 冒頭で staff チェック
 * - クライアントから受け取るのは「基幹側のメール行 ID」と「添付の番号」だけ。
 *   Gmail の message id / attachment id は DB の添付メタデータから解決する（任意 ID を中継しない）
 * - Gmail の attachmentId は取得のたびに変わり得るため、message を取り直して part_id から特定する
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; index: string }> },
) {
  const staff = await getStaffOrNull();
  if (!staff) return json({ error: "権限がありません" }, 403);

  const { id, index } = await ctx.params;
  if (!UUID_RE.test(id) || !/^\d{1,3}$/.test(index)) return json({ error: "見つかりません" }, 404);

  // RLS（staff 限定）が効く通常クライアントで行を引く
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("inbound_emails")
    .select("gmail_message_id, attachments")
    .eq("id", id)
    .maybeSingle();
  if (!row) return json({ error: "見つかりません" }, 404);

  const meta = (row.attachments as InboundEmailAttachment[] | null)?.[Number(index)];
  if (!meta) return json({ error: "見つかりません" }, 404);

  // Vercel のレスポンス上限を超える添付は Gmail 側で開いてもらう
  if (meta.size > MAX_ATTACHMENT_BYTES) {
    return json({ error: "サイズが大きいため、Gmail で開いてください", code: "too_large" }, 413);
  }

  if (!isGmailConfigured()) {
    return json({ error: GMAIL_ERROR_MESSAGES.not_configured, code: "not_configured" }, 503);
  }

  try {
    const client = getGmailClient();
    const msg = await client.getMessage(row.gmail_message_id);
    if (!msg) return json({ error: "Gmail 上にメールが見つかりません（削除された可能性があります）" }, 404);
    const part = findPartById(msg, meta.part_id);
    if (!part) return json({ error: "Gmail 上に添付が見つかりません" }, 404);

    let bytes: Buffer;
    if (part.body?.attachmentId) {
      bytes = await client.getAttachmentData(row.gmail_message_id, part.body.attachmentId);
    } else if (part.body?.data) {
      bytes = decodeBase64Url(part.body.data);
    } else {
      return json({ error: "Gmail 上に添付が見つかりません" }, 404);
    }
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      return json({ error: "サイズが大きいため、Gmail で開いてください", code: "too_large" }, 413);
    }

    // メール由来の Content-Type は信用せず、常にダウンロード扱いのバイナリとして返す
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": contentDisposition(meta.filename),
        "Content-Length": String(bytes.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    const message = e instanceof GmailError ? e.message : GMAIL_ERROR_MESSAGES.unknown;
    console.error(`[mail-attachment] failed: ${e instanceof GmailError ? e.code : "unknown"}`);
    return json({ error: message }, 502);
  }
}
