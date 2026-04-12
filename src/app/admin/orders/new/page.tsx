import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminOrderFormClient } from "@/components/admin/AdminOrderFormClient";

interface NewAdminOrderPageProps {
  searchParams: Promise<{ error?: string; customer_id?: string }>;
}

export default async function NewAdminOrderPage({ searchParams }: NewAdminOrderPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address")
    .order("name", { ascending: true });

  // 現在の消費税率を取得
  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const taxRate = taxSetting?.rate ?? 10;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文を作成</h1>
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <AdminOrderFormClient customers={customers ?? []} today={today} taxRate={taxRate} presetCustomerId={sp.customer_id} />
    </div>
  );
}
