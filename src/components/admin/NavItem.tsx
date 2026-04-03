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
      className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
        isActive
          ? "bg-brand-50 text-brand-700 font-medium border-r-2 border-brand-600"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
