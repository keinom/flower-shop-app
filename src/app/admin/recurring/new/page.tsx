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

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address")
    .order("name", { ascending: true });

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
        customers={customers ?? []}
        today={today}
        taxRate={taxRate}
      />
    </div>
  );
}
