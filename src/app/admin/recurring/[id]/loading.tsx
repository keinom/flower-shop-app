// 定期注文テンプレート詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function RecurringDetailLoading() {
  return (
    <div className="space-y-5 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* 顧客情報 + 繰り返し設定 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card p-5 space-y-4">
            <Skeleton className="h-4 w-20 border-b pb-2" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 商品明細 */}
      <div className="card p-5">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      </div>

      {/* 最近の注文 */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
