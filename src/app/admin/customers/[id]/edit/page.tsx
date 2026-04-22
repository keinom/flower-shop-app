import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "../../actions";
import { PostalCodeAutoFill } from "@/components/ui/PostalCodeAutoFill";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function EditCustomerPage({
  params,
  searchParams,
}: EditCustomerPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, email, postal_code, address, notes")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/customers/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 顧客詳細に戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">顧客情報を編集</h1>
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={updateCustomer} className="card p-6 space-y-6">
        <input type="hidden" name="id" value={customer.id} />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            基本情報
          </h2>

          <div>
            <label htmlFor="name" className="label">
              顧客名 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={customer.name ?? ""}
              placeholder="例: 株式会社○○ / 田中 花子"
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="label">
                電話番号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={customer.phone ?? ""}
                placeholder="例: 03-1234-5678"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="email" className="label">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
                placeholder="例: info@example.com"
                className="input"
              />
            </div>
          </div>

          <PostalCodeAutoFill
            postalCodeName="postal_code"
            addressName="address"
            defaultPostalCode={customer.postal_code ?? ""}
            defaultAddress={customer.address ?? ""}
            addressPlaceholder="例: 東京都千代田区1-1-1 ○○ビル3F"
          />

          <div>
            <label htmlFor="notes" className="label">
              備考
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={customer.notes ?? ""}
              placeholder="例: 毎月1回定期注文あり、担当者: 鈴木様"
              className="input resize-none"
            />
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary">
            変更を保存
          </button>
          <Link href={`/admin/customers/${id}`} className="btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
