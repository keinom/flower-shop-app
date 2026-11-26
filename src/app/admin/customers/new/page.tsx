import Link from "next/link";
import { CustomerCreateForm } from "@/components/admin/CustomerCreateForm";
import { newIdempotencyKey } from "@/lib/idempotency";

export default async function NewCustomerPage() {
  // フォーム表示ごとに冪等キーを発行（リロードで新しいキー＝別の送信）
  const idempotencyKey = newIdempotencyKey();

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="text-sm text-gray-500 hover:text-gray-700">
          ← 顧客一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">顧客を登録</h1>
      </div>

      <CustomerCreateForm idempotencyKey={idempotencyKey} />
    </div>
  );
}
