"use client";

import Link from "next/link";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RecurringDetailError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[定期注文詳細] エラー:", error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto mt-16 space-y-4 text-center">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-lg font-bold text-gray-900">
        定期注文の詳細を読み込めませんでした
      </h2>
      <p className="text-sm text-gray-500">
        {error.message || "予期しないエラーが発生しました"}
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400">エラーID: {error.digest}</p>
      )}
      <div className="flex justify-center gap-3 pt-2">
        <button onClick={reset} className="btn-secondary text-sm">
          再試行
        </button>
        <Link href="/admin/recurring" className="btn-ghost text-sm">
          ← 定期注文一覧へ戻る
        </Link>
      </div>
    </div>
  );
}
