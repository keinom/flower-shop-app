// 請求書詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function InvoiceDetailLoading() {
  return (
    <div className="space-y-5 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-9 w-16 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* 請求先情報 */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-20 border-b pb-2" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>

      {/* 明細 */}
      <div className="card p-5">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="table-container">
          <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-4 gap-4 px-4 py-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-8 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ステータス操作 */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}
