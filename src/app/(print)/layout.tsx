/**
 * 印刷専用レイアウト
 * 管理画面のナビゲーションを含まないクリーンなレイアウト
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
