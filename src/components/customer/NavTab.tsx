"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavTabProps {
  href: string;
  label: string;
  exact?: boolean;
}

export function NavTab({ href, label, exact = false }: NavTabProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`py-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? "text-brand-700 border-brand-600"
          : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {label}
    </Link>
  );
}
