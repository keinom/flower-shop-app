// 顧客一覧 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function CustomersLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* テーブル */}
      <div className="table-container">
        <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-7 gap-4 px-4 py-3">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-4 px-4 py-3.5 items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-10 mx-auto" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
