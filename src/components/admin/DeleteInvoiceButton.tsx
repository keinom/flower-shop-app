"use client";

import { deleteInvoice } from "@/app/admin/invoices/[id]/actions";

interface Props {
  invoiceId: string;
}

export function DeleteInvoiceButton({ invoiceId }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("この請求書を削除しますか？")) {
      e.preventDefault();
    }
  };

  return (
    <form action={deleteInvoice} onSubmit={handleSubmit}>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <button
        type="submit"
        className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
      >
        削除する
      </button>
    </form>
  );
}
