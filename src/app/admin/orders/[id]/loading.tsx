// 注文詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function OrderDetailLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* 注文内容 + お届け情報 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card p-5 space-y-4">
            <Skeleton className="h-4 w-20 border-b pb-2" />
            <div className="space-y-4">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 商品明細 */}
      <div className="card p-5">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="table-container">
          <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-4 gap-4 px-4 py-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-8 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-end gap-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* ステータス更新 */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* 変更履歴 */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-20" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-1.5 w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-4" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
