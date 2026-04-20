"use client";

interface PrintBarProps {
  title: string;
}

/**
 * 印刷専用ページ共通のトップバー（印刷時は非表示）
 * window.print() / window.close() を持つ Client Component
 */
export function PrintBar({ title }: PrintBarProps) {
  return (
    <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white px-5 py-2.5 flex items-center gap-3 text-sm shadow-lg">
      <span className="font-semibold">{title}</span>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => window.print()}
          className="bg-white text-gray-800 px-4 py-1.5 rounded font-semibold hover:bg-gray-100 transition-colors"
        >
          🖨 印刷する
        </button>
        <button
          onClick={() => window.close()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕ 閉じる
        </button>
      </div>
    </div>
  );
}
