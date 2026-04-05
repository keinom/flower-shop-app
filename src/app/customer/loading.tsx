// 顧客トップ（注文履歴）ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function CustomerTopLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* 対応中バナー */}
      <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3">
        <Skeleton className="h-4 w-48" />
      </div>

      {/* ステータスフィルター */}
      <div className="flex flex-wrap gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      {/* 注文カード一覧 */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card p-4 flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex items-center gap-3 ml-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
