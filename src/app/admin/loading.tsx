// ダッシュボード ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-36" />

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>

      {/* ステータス別件数 */}
      <div className="card p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-gray-50 space-y-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-7 w-8" />
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
      </div>

      {/* 直近の注文テーブル */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 px-5 py-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
