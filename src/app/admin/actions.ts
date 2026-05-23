"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";

export async function bulkUpdateOrderStatus(orderIds: string[], newStatus: OrderStatus) {
  if (orderIds.length === 0) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "employee") {
    throw new Error("権限がありません");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .in("id", orderIds);

  if (error) throw new Error("ステータスの更新に失敗しました");

  revalidatePath("/admin");
}
