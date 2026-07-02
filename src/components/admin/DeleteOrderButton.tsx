"use client";

import { deleteOrder } from "@/app/admin/orders/[id]/actions";

interface Props {
  orderId: string;
  deliveryName: string;
}

export function DeleteOrderButton({ orderId, deliveryName }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (
      !confirm(
        `「${deliveryName}」宛の注文を完全に削除しますか？\n\n商品明細・変更履歴・写真もすべて削除されます。\nこの操作は取り消せません。`
      )
    ) {
      e.preventDefault();
    }
  };

  return (
    <form action={deleteOrder} onSubmit={handleSubmit}>
      <input type="hidden" name="order_id" value={orderId} />
      <button
        type="submit"
        className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
      >
        🗑 この注文を削除する
      </button>
    </form>
  );
}
