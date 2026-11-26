"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMailBadgeCount } from "./MailBadgeProvider";

interface NavItemProps {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  /** 件数バッジ（0・null・undefined のときは表示しない） */
  badge?: number | null;
  /** true のとき、バッジを「未対応メール件数」（MailBadgeProvider で自動更新される値）にする */
  mailBadge?: boolean;
}

export function NavItem({ href, label, icon, exact = false, badge: badgeProp, mailBadge = false }: NavItemProps) {
  const pathname = usePathname();
  const mailCount = useMailBadgeCount();
  const badge = mailBadge ? mailCount : badgeProp;
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 mx-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
        isActive
          ? "bg-brand-100 text-brand-800 font-semibold shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="ml-auto min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold leading-none text-center"
          aria-label={`未対応 ${badge} 件`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {isActive && (
        <span
          className={`${badge != null && badge > 0 ? "" : "ml-auto "}w-1.5 h-1.5 rounded-full bg-brand-600`}
        />
      )}
    </Link>
  );
}
