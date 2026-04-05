// 顧客詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-32" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* 顧客情報カード */}
      <div className="card p-5">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* 月ピル */}
      <div className="flex items-center gap-2 flex-wrap">
        <Skeleton className="h-7 w-6" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
        <Skeleton className="h-7 w-6" />
      </div>

      {/* 月合計 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* 注文グループ */}
      {[...Array(2)].map((_, g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="card divide-y divide-gray-100">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
