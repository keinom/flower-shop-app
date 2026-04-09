"use client";

import { useEffect } from "react";

interface Props {
  orderId: string;
  currentType: "standard" | "gift";
}

export function PrintActions({ orderId, currentType }: Props) {
  useEffect(() => {
    // 印刷直前: A5横(210×148mm)に収まるよう自動縮小
    const handleBeforePrint = () => {
      const page = document.querySelector(".dn-page") as HTMLElement | null;
      if (!page) return;

      // zoom をいったんリセットして実寸を取得
      page.style.zoom = "1";

      // 96dpi基準: 1mm ≈ 3.7795px
      const PX_PER_MM = 96 / 25.4;
      const targetH = 148 * PX_PER_MM; // A5高さ (px)
      const targetW = 210 * PX_PER_MM; // A5幅   (px)

      const contentH = page.scrollHeight;
      const contentW = page.scrollWidth;

      const scale = Math.min(targetH / contentH, targetW / contentW, 1);

      // zoom はレイアウト自体を縮小するため印刷に確実に反映される
      page.style.zoom = String(scale);
    };

    // 印刷後: ズームをリセット
    const handleAfterPrint = () => {
      const page = document.querySelector(".dn-page") as HTMLElement | null;
      if (!page) return;
      page.style.zoom = "1";
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
      <span className="font-semibold">
        {currentType === "standard" ? "📄 自社宛 納品書" : "🎁 ギフト用 納品書"}
      </span>

      {/* 種別切替 */}
      <div className="flex gap-1.5 ml-2">
        <a
          href={`/orders/${orderId}/delivery-note?type=standard`}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            currentType === "standard"
              ? "bg-white text-gray-800"
              : "bg-gray-600 text-gray-200 hover:bg-gray-500"
          }`}
        >
          自社宛
        </a>
        <a
          href={`/orders/${orderId}/delivery-note?type=gift`}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            currentType === "gift"
              ? "bg-white text-gray-800"
              : "bg-gray-600 text-gray-200 hover:bg-gray-500"
          }`}
        >
          ギフト用
        </a>
      </div>

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
