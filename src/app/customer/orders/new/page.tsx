import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewOrderFormClient } from "./NewOrderFormClient";

export default async function NewOrderPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 顧客情報を取得（クイック入力用）
  const { data: customer } = await supabase
    .from("customers")
    .select("name, address, phone, email")
    .eq("profile_id", user.id)
    .single();

  // 今日の日付（delivery_date の min 値用）
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/customer" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文履歴
        </Link>
        <h1 className="text-xl font-bold text-gray-900">新しい注文をする</h1>
      </div>

      <NewOrderFormClient customer={customer} today={today} />
    </div>
  );
}
