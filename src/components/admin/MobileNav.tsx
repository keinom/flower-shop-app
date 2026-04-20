"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { NavItem } from "./NavItem";

interface Props {
  isAdmin:     boolean;
  displayName: string;
}

export function MobileNav({ isAdmin, displayName }: Props) {
  const [open, setOpen]   = useState(false);
  const pathname          = usePathname();

  // ページ遷移時にドロワーを閉じる
  useEffect(() => { setOpen(false); }, [pathname]);

  // ドロワー開いている間はbodyスクロール禁止
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ハンバーガーボタン（モバイルのみ表示） */}
      <button
        type="button"
        aria-label="メニューを開く"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/80 hover:bg-white/10 active:bg-white/20 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6"  x2="19" y2="6"  />
          <line x1="3" y1="11" x2="19" y2="11" />
          <line x1="3" y1="16" x2="19" y2="16" />
        </svg>
      </button>

      {/* オーバーレイ */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ドロワー */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-72 flex flex-col md:hidden
          transition-transform duration-250 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "#fafaf9", borderRight: "1px solid #e5e7eb" }}
      >
        {/* ドロワーヘッダー */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #1a3d2e 0%, #255f47 100%)",
          }}
        >
          <span className="text-sm font-semibold text-white/90 truncate">{displayName}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="メニューを閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3"  y2="13" />
            </svg>
          </button>
        </div>

        {/* ナビゲーション */}
        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-3 mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
              メニュー
            </p>
          </div>
          <NavItem href="/admin"           label="ダッシュボード" icon="📊" exact />
          <NavItem href="/admin/daily"     label="日報"           icon="📅" />
          <NavItem href="/admin/customers" label="顧客検索"       icon="👥" />
          <NavItem href="/admin/orders"    label="注文検索"       icon="📋" />
          <NavItem href="/admin/recurring" label="定期注文"       icon="🔄" />
          <NavItem href="/admin/invoices"  label="請求書"         icon="📄" />
          <NavItem href="/admin/fuda"      label="立て札"         icon="🌸" />
          <NavItem href="/admin/print"     label="帳票印刷"       icon="🖨️" />

          <div className="mx-4 my-3 border-t border-gray-200" />
          <div className="px-3 mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
              シフト
            </p>
          </div>
          <NavItem href="/admin/shifts/my" label="シフト希望" icon="🗓️" />
          {isAdmin && <NavItem href="/admin/shifts" label="シフト管理" icon="📆" />}

          {isAdmin && (
            <>
              <div className="mx-4 my-3 border-t border-gray-200" />
              <div className="px-3 mb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                  設定
                </p>
              </div>
              <NavItem href="/admin/users"    label="ユーザー管理" icon="🔑" />
              <NavItem href="/admin/settings" label="設定"         icon="⚙️" />
            </>
          )}
        </div>
      </div>
    </>
  );
}
