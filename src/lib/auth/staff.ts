import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/server";

export interface StaffUser {
  id: string;
  role: "admin" | "employee";
  displayName: string | null;
}

/**
 * staff（admin / employee）としてログインしていればそのユーザー、そうでなければ null。
 * Server Action / Route Handler の冒頭で必ず呼ぶ。
 * （/api 配下は middleware のロール制御対象外のため、自前チェックが必須）
 */
export async function getStaffOrNull(): Promise<StaffUser | null> {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !profile) return null;
  if (profile.role !== "admin" && profile.role !== "employee") return null;
  return { id: user.id, role: profile.role, displayName: profile.display_name };
}

/** ページ用: staff でなければリダイレクト（layout と同じ振り分け） */
export async function requireStaffOrRedirect(): Promise<StaffUser> {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/customer");
  return { id: user.id, role: profile.role, displayName: profile.display_name };
}
