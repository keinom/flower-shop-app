"use server";

import { revalidatePath } from "next/cache";
import { getStaffOrNull } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { INBOUND_EMAIL_STATUSES } from "@/lib/constants";
import type { InboundEmailStatus } from "@/types";

export type MailActionResult = { ok: true; count?: number } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BULK = 200;
const MAX_MEMO = 5000;

function isStatus(v: unknown): v is InboundEmailStatus {
  return typeof v === "string" && (INBOUND_EMAIL_STATUSES as string[]).includes(v);
}

/** 未対応件数バッジ（全ページのレイアウトに出る）を含めて再描画させる */
function revalidateMail(id?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/mail");
  if (id) revalidatePath(`/admin/mail/${id}`);
}

/**
 * 一覧で選択した複数メールのステータスを一括変更する。
 * 冒頭で staff チェック（アプリ層）。さらに RLS（staff 限定）と列権限が DB 側で二重に守る。
 * ステータスの最終更新者・日時は DB トリガーが auth.uid() で記録する。
 */
export async function bulkUpdateMailStatus(
  ids: string[],
  status: InboundEmailStatus,
): Promise<MailActionResult> {
  const staff = await getStaffOrNull();
  if (!staff) return { ok: false, error: "権限がありません" };

  if (!isStatus(status)) return { ok: false, error: "ステータスが不正です" };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "メールが選択されていません" };
  if (ids.length > MAX_BULK || !ids.every((i) => typeof i === "string" && UUID_RE.test(i))) {
    return { ok: false, error: "選択が不正です" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbound_emails")
    .update({ status })
    .in("id", ids)
    .select("id");
  if (error) return { ok: false, error: "ステータスの更新に失敗しました" };

  revalidateMail();
  return { ok: true, count: data?.length ?? 0 };
}

/** 詳細画面: ステータス・担当者・メモをまとめて保存する */
export async function updateMailMeta(
  id: string,
  input: { status: InboundEmailStatus; assignedTo: string | null; memo: string },
): Promise<MailActionResult> {
  const staff = await getStaffOrNull();
  if (!staff) return { ok: false, error: "権限がありません" };

  if (!UUID_RE.test(id)) return { ok: false, error: "メールが見つかりません" };
  if (!isStatus(input?.status)) return { ok: false, error: "ステータスが不正です" };
  const memo = (input.memo ?? "").toString();
  if (memo.length > MAX_MEMO) return { ok: false, error: `メモは${MAX_MEMO}文字以内で入力してください` };

  const supabase = await createClient();

  // 担当者は staff（admin / employee）のみ指定可。未割当は null。
  let assignedTo: string | null = null;
  if (input.assignedTo) {
    if (!UUID_RE.test(input.assignedTo)) return { ok: false, error: "担当者が不正です" };
    const { data: p } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", input.assignedTo)
      .in("role", ["admin", "employee"])
      .maybeSingle();
    if (!p) return { ok: false, error: "担当者が不正です" };
    assignedTo = p.id;
  }

  const { data, error } = await supabase
    .from("inbound_emails")
    .update({ status: input.status, assigned_to: assignedTo, memo: memo.trim() ? memo : null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "保存に失敗しました" };
  if (!data || data.length === 0) return { ok: false, error: "メールが見つかりません" };

  revalidateMail(id);
  return { ok: true };
}
