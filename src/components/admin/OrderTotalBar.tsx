"use client";

interface Props {
  itemsTotal: number;   // tax-inclusive product total
  shippingFee: number;  // tax-inclusive shipping fee (0 if none)
}

export function OrderTotalBar({ itemsTotal, shippingFee }: Props) {
  const grandTotal = itemsTotal + shippingFee;

  return (
    <div className="sticky bottom-4 z-20 pointer-events-none">
      <div className="pointer-events-auto mx-auto">
        <div className="rounded-2xl bg-brand-800 text-white shadow-2xl px-5 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-sm text-brand-200">
            <span>
              商品合計&nbsp;
              <span className="text-white font-semibold">¥{itemsTotal.toLocaleString("ja-JP")}</span>
            </span>
            {shippingFee > 0 && (
              <>
                <span className="text-brand-400">＋</span>
                <span>
                  配送料&nbsp;
                  <span className="text-white font-semibold">¥{shippingFee.toLocaleString("ja-JP")}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 flex-shrink-0">
            <span className="text-brand-300 text-sm">合計</span>
            <span className="text-2xl font-black">¥{grandTotal.toLocaleString("ja-JP")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
