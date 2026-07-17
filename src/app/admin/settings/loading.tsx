// 設定 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-xl">
      <Skeleton className="h-7 w-16" />

      {/* 消費税率設定 */}
      <div className="card p-5 space-y-4">
        <div className="space-y-1.5 border-b pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* 変更履歴 */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-20 border-b pb-2" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-1.5 w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
