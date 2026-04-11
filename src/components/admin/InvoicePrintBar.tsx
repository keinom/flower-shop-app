"use client";

interface Props {
  invoiceNumber: string;
  invoiceId: string;
}

export function InvoicePrintBar({ invoiceNumber, invoiceId }: Props) {
  return (
    <div
      className="no-print"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "white", borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px",
        display: "flex", alignItems: "center", gap: "12px",
      }}
    >
      <button
        onClick={() => window.print()}
        style={{
          padding: "8px 20px",
          background: "#8B6914",
          color: "white",
          border: "none",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "600",
          cursor: "pointer",
        }}
      >
        🖨 印刷 / PDF保存
      </button>
      <a
        href={`/admin/invoices/${invoiceId}`}
        style={{ fontSize: "13px", color: "#6b7280", textDecoration: "none" }}
      >
        ← 請求書詳細に戻る
      </a>
      <span style={{ marginLeft: "auto", fontSize: "12px", color: "#9ca3af" }}>
        {invoiceNumber}
      </span>
    </div>
  );
}
