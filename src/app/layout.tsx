import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "花屋注文管理システム",
  description: "花屋の法人・継続顧客向け注文管理システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
