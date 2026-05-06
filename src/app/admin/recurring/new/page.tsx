import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RecurringTemplateFormClient } from "./RecurringTemplateFormClient";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewRecurringTemplatePage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // PostgREST max-rows=1000 を超える顧客を取りこぼさないよう、ページング取得
  type Customer = { id: string; name: string; phone: string | null; email: string | null; postal_code: string | null; address: string | null };
  const customers: Customer[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, postal_code, address")
      .order("name", { ascending: true })
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    customers.push(...data);
    if (data.length < 1000) break;
  }

  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const taxRate = taxSetting?.rate ?? 10;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/admin/recurring" className="text-sm text-gray-500 hover:text-gray-700">
          ← 定期注文
        </Link>
        <h1 className="text-xl font-bold text-gray-900">定期注文を作成</h1>
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <RecurringTemplateFormClient
        customers={customers}
        today={today}
        taxRate={taxRate}
      />
    </div>
  );
}
