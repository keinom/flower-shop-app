"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentStatus } from "@/app/admin/orders/[id]/actions";

type PaymentStatus = "代済み" | "代未";

const PAYMENT_METHODS = ["レジ", "クレジットカード", "振込", "その他"] as const;
const PAYMENT_PLANS   = ["後日店頭支払い", "請求書送付", "月末まとめて請求書送付", "その他"] as const;

interface Props {
  orderId: string;
  currentPaymentStatus: string | null;
  currentPaymentMethod: string | null;
  currentPaymentPlan:   string | null;
}

export function PaymentPanel({
  orderId,
  currentPaymentStatus,
  currentPaymentMethod,
  currentPaymentPlan,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status,  setStatus]  = useState<PaymentStatus | "">(
    (currentPaymentStatus as PaymentStatus) ?? ""
  );
  const [method,  setMethod]  = useState(currentPaymentMethod ?? "");
  const [plan,    setPlan]    = useState(currentPaymentPlan   ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved,    setSaved]    = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaved(false);

    const fd = new FormData();
    fd.set("order_id",       orderId);
    fd.set("payment_status", status);
    if (status === "代済み") fd.set("payment_method", method);
    if (status === "代未")   fd.set("payment_plan",   plan);

    startTransition(async () => {
      const result = await updatePaymentStatus(fd);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  // ステータス変更時にサブ選択をリセット
  const handleStatusChange = (v: PaymentStatus) => {
    setStatus(v);
    setMethod("");
    setPlan("");
    setSaved(false);
  };

  const statusColor = currentPaymentStatus === "代済み"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : currentPaymentStatus === "代未"
    ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-gray-400 bg-gray-50 border-gray-200";

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">支払い</h2>

      {/* 現在の支払い状況 */}
      <div className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold mb-4 ${statusColor}`}>
        {currentPaymentStatus ?? "未設定"}
        {currentPaymentStatus === "代済み" && currentPaymentMethod && (
          <span className="ml-1.5 text-xs font-normal">（{currentPaymentMethod}）</span>
        )}
        {currentPaymentStatus === "代未" && currentPaymentPlan && (
          <span className="ml-1.5 text-xs font-normal">（{currentPaymentPlan}）</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 代済み / 代未 */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">支払い状況 <span className="text-red-500">*</span></p>
          <div className="flex gap-2">
            {(["代済み", "代未"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleStatusChange(v)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  status === v
                    ? v === "代済み"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 代済み: 支払い方法 */}
        {status === "代済み" && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">支払い方法（任意）</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(method === m ? "" : m)}
                  className={`py-1.5 rounded-md text-xs font-medium border transition-all ${
                    method === m
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 代未: 支払い予定 */}
        {status === "代未" && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">支払い予定（任意）</p>
            <div className="flex flex-col gap-1.5">
              {PAYMENT_PLANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(plan === p ? "" : p)}
                  className={`py-1.5 px-3 rounded-md text-xs font-medium border text-left transition-all ${
                    plan === p
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* エラー */}
        {errorMsg && (
          <p className="text-xs text-red-600">{errorMsg}</p>
        )}

        {/* 保存 */}
        <button
          type="submit"
          disabled={!status || isPending}
          className="btn-primary w-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "保存中..." : saved ? "✓ 保存しました" : "保存する"}
        </button>
      </form>
    </div>
  );
}
