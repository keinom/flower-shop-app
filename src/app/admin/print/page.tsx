/**
 * 帳票印刷ハブ
 * 印刷可能な帳票一覧を表示し、新しいタブで印刷画面を開く
 */
export default function PrintHubPage() {
  const forms = [
    {
      id:          "order-slip",
      title:       "御注文票",
      description: "手書き注文表と同一レイアウト。A5縦で印刷。",
      size:        "A5 縦",
      href:        "/print/order-slip",
      icon:        "📋",
    },
    // 今後ここに帳票を追加していく
  ] as const;

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">帳票印刷</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          印刷したい帳票を選択してください。新しいタブで印刷プレビューが開きます。
        </p>
      </div>

      {/* 帳票カード一覧 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((form) => (
          <div key={form.id} className="card p-5 flex flex-col gap-3">
            {/* アイコン + タイトル */}
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none">{form.icon}</span>
              <div>
                <h2 className="font-semibold text-gray-900 text-base">{form.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{form.description}</p>
              </div>
            </div>

            {/* サイズバッジ */}
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {form.size}
              </span>
            </div>

            {/* 印刷ボタン */}
            <a
              href={form.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm text-center mt-auto"
            >
              🖨 印刷画面を開く
            </a>
          </div>
        ))}

        {/* 空スロット（今後追加予定） */}
        <div className="card p-5 flex flex-col items-center justify-center gap-2 border-dashed opacity-50 min-h-[140px]">
          <span className="text-2xl">＋</span>
          <p className="text-xs text-gray-400 text-center">今後の帳票を追加予定</p>
        </div>
      </div>
    </div>
  );
}
