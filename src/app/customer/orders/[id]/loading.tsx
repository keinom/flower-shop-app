// 顧客 注文詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function CustomerOrderDetailLoading() {
  return (
    <div className="space-y-5 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* 注文内容カード */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>

      {/* お届け情報カード */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>

      {/* 商品明細 */}
      <div className="card p-5">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="divide-y divide-gray-100">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-between py-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
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

      {/* 編集ボタン */}
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
