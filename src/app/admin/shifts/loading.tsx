// シフト管理 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function ShiftsLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー + 月切り替え */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Skeleton className="h-7 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="card p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-6 mx-auto" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[...Array(35)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
