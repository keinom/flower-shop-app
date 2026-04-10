"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";

export async function updateOrderStatusQuick(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ error: string } | null> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (!current) return { error: "注文が見つかりません" };
  if (current.status === newStatus) return null;

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (error) return { error: error.message };

  if (user) {
    await supabase.from("order_status_logs").insert({
      order_id: orderId,
      old_status: current.status as OrderStatus,
      new_status: newStatus,
      changed_by: user.id,
      note: null,
    });
  }

  revalidatePath("/admin/daily");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");

  return null;
}
