// 帳票印刷ハブ ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function PrintLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-72" />
      </div>

      {/* 帳票カード一覧 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-9 w-full rounded-lg mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
