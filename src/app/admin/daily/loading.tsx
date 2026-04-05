// 日報 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function DailyLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Skeleton className="h-7 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* 2日分グリッド */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, col) => (
          <div key={col} className="card overflow-hidden">
            {/* カラムヘッダー */}
            <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-5 w-48" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
            {/* 注文カード */}
            <div className="divide-y divide-gray-100">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-28 rounded-md" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-52" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
