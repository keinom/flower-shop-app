import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FudaDetailClient } from "./FudaDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

interface FudaDoc {
  id:             string;
  file_name:      string;
  storage_path:   string;
  occasion:       string | null;
  recipient:      string | null;
  sender:         string | null;
  all_text:       string | null;
  ocr_confidence: string | null;
  ocr_done:       boolean;
  ocr_error:      string | null;
  created_at:     string;
}

export default async function FudaDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  // 立て札データ取得
  const { data: doc } = await supabase
    .from("fuda_documents" as never)
    .select("id, file_name, storage_path, occasion, recipient, sender, all_text, ocr_confidence, ocr_done, ocr_error, created_at")
    .eq("id", id)
    .single() as { data: FudaDoc | null };

  if (!doc) notFound();

  // PDF 署名付き URL 生成（1時間有効）
  const { data: signedData } = await supabase.storage
    .from("fuda-pdfs")
    .createSignedUrl(doc.storage_path, 3600);

  const pdfUrl = signedData?.signedUrl ?? "";

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/fuda" className="text-sm text-gray-500 hover:text-gray-700">
          ← 立て札一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900 truncate max-w-sm">
          {doc.file_name}
        </h1>
        {!doc.ocr_done && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
            OCR 処理中...
          </span>
        )}
        {doc.ocr_done && !doc.ocr_error && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            OCR 完了
          </span>
        )}
      </div>

      <FudaDetailClient
        id={doc.id}
        pdfUrl={pdfUrl}
        isAdmin={profile?.role === "admin"}
        fileName={doc.file_name}
        occasion={doc.occasion}
        recipient={doc.recipient}
        sender={doc.sender}
        allText={doc.all_text}
        confidence={doc.ocr_confidence}
        ocrError={doc.ocr_error}
        createdAt={doc.created_at}
      />
    </div>
  );
}
