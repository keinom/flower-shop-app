"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createMailBadgePoller, fetchUnhandledMailCount, type MailBadgePoller } from "@/lib/mailBadgeClient";

const MailBadgeContext = createContext<number | null>(null);

/** ナビの「未対応メール件数」（取得失敗・未取得は null → バッジ非表示） */
export function useMailBadgeCount(): number | null {
  return useContext(MailBadgeContext);
}

/**
 * 管理画面（staff 用レイアウトのみ）で未対応件数を保持・自動更新する。
 * - 初期値と、ステータス変更後などのサーバー再描画で渡ってくる値は initialCount（サーバーの値を正とする）
 * - 画面表示中は一定間隔、タブ復帰時にも件数だけを取り直す（router.refresh は使わない）
 */
export function MailBadgeProvider({
  initialCount,
  children,
}: {
  initialCount: number | null;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState<number | null>(initialCount);
  const [prevInitial, setPrevInitial] = useState<number | null>(initialCount);
  const pollerRef = useRef<MailBadgePoller | null>(null);

  // サーバー側の値が変わったら（再描画で新しい値が来たら）それに合わせる
  if (prevInitial !== initialCount) {
    setPrevInitial(initialCount);
    setCount(initialCount);
  }

  // 取得中の古い応答を捨てる（ステータス変更直後に古い数字へ巻き戻らないように）
  useEffect(() => {
    pollerRef.current?.invalidate();
  }, [initialCount]);

  useEffect(() => {
    const poller = createMailBadgePoller({
      fetchCount: fetchUnhandledMailCount,
      onCount: setCount,
      isVisible: () => document.visibilityState === "visible",
    });
    pollerRef.current = poller;
    poller.start();
    const onChange = () => poller.onVisibilityChange();
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("focus", onChange);
      poller.stop();
      pollerRef.current = null;
    };
  }, []);

  return <MailBadgeContext.Provider value={count}>{children}</MailBadgeContext.Provider>;
}
