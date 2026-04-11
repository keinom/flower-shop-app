"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function InvoiceDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[InvoiceDetailError]", error);
  }, [error]);

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="text-lg font-bold text-red-600">請求書詳細の読み込みに失敗しました</h2>
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 font-mono whitespace-pre-wrap">
        {error.message}
        {error.digest && <div className="mt-2 text-xs text-red-400">digest: {error.digest}</div>}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          再試行
        </button>
        <Link href="/admin/invoices" className="px-4 py-2 text-sm font-medium border rounded-md text-gray-600 hover:bg-gray-50">
          一覧に戻る
        </Link>
      </div>
    </div>
  );
}
