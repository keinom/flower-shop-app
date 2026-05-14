"use client";

import { useEffect } from "react";

export function PrintActions() {
  useEffect(() => {
    // 印刷直前: A5横 (210×148mm) に収まるよう自動縮小
    const handleBeforePrint = () => {
      const page = document.querySelector(".om-page") as HTMLElement | null;
      if (!page) return;

      page.style.zoom = "1";
      const contentH = page.scrollHeight;

      // A5横の高さ148mm → px (1mm = 3.7795px @ 96dpi) ≈ 559px
      const A5_H_PX = 148 * (96 / 25.4);
      if (contentH > A5_H_PX) {
        page.style.zoom = String(A5_H_PX / contentH);
      }
    };
    const handleAfterPrint = () => {
      const page = document.querySelector(".om-page") as HTMLElement | null;
      if (page) page.style.zoom = "1";
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  return (
    <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white px-5 py-2.5 flex items-center gap-3 text-sm shadow-lg">
      <span className="font-semibold">📝 注文メモ（内部用）</span>

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
