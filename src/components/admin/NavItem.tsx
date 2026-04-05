"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export function NavItem({ href, label, icon, exact = false }: NavItemProps) {
  const pathname = usePathname();
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
      {isActive && (
        <span
          className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600"
        />
      )}
    </Link>
  );
}
