"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "fuda-pdfs";

// ── OCR 結果の型 ──────────────────────────────────────
interface OcrResult {
  occasion:   string | null;
  recipient:  string | null;
  sender:     string | null;
  all_text:   string;
  confidence: "high" | "medium" | "low";
}

// ── Gemini Vision OCR ────────────────────────────────
async function runGeminiOcr(pdfBuffer: ArrayBuffer): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません");

  const base64 = Buffer.from(pdfBuffer).toString("base64");

  const prompt = `この画像/PDFは花屋の「立て札」（フラワーアレンジメントに添える立て看板）です。
縦書きの毛筆フォントで書かれており、複数ページにわたって1つのメッセージが構成されている場合があります。
全ページのテキストをすべて読み取り、以下のJSON形式のみで返してください（説明文は不要）:

{
  "occasion":  "用途・祝い事（例: 祝開店、祝御就任、御結婚お祝いなど。記載なしはnull）",
  "recipient": "宛名・受取人名（例: 田中様、○○株式会社様。記載なしはnull）",
  "sender":    "差出人・贈り主名（例: 山田商店、株式会社○○。記載なしはnull）",
  "all_text":  "読み取れた全テキストを改行区切りで連結した文字列",
  "confidence":"読み取り確信度（high/medium/lowのいずれか）"
}

注意:
- 読み取れない文字は「□」で代替してください
- 縦書きを横書きに変換して返してください
- 「様」「御中」などの敬称はそのまま含めてください`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "application/pdf", data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  // ```json ... ``` ブロックがあれば中身を取り出す
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonText  = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  try {
    const parsed = JSON.parse(jsonText) as OcrResult;
    return {
      occasion:   parsed.occasion   ?? null,
      recipient:  parsed.recipient  ?? null,
      sender:     parsed.sender     ?? null,
      all_text:   parsed.all_text   ?? raw,
      confidence: parsed.confidence ?? "low",
    };
  } catch {
    // JSON パース失敗時はテキストをそのまま格納
    return { occasion: null, recipient: null, sender: null, all_text: raw, confidence: "low" };
  }
}

// ── 内部: 1ファイルアップロード + OCR ───────────────
async function processSingleFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  file: File,
  userId: string
): Promise<{ id?: string; error?: string }> {
  // PDFバリデーション
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return { error: `${file.name} はPDFファイルではありません` };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: `${file.name} のサイズが 10MB を超えています` };
  }

  const storagePath = `${crypto.randomUUID()}.pdf`;

  // 1. ストレージへアップロード
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, new Uint8Array(arrayBuffer), {
      contentType: "application/pdf",
    });

  if (uploadError) {
    return { error: `ストレージへのアップロードに失敗しました: ${uploadError.message}` };
  }

  // 2. DB レコード作成（OCR 前の仮登録）
  const { data: doc, error: dbError } = await supabase
    .from("fuda_documents" as never)
    .insert({
      file_name:   file.name,
      storage_path: storagePath,
      created_by:  userId,
      ocr_done:    false,
    } as never)
    .select("id")
    .single();

  if (dbError || !doc) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: `DB への保存に失敗しました: ${(dbError as { message?: string })?.message ?? ""}` };
  }

  const docId = (doc as { id: string }).id;

  // 3. Gemini OCR 実行
  try {
    const ocr = await runGeminiOcr(arrayBuffer);
    await supabase
      .from("fuda_documents" as never)
      .update({
        occasion:       ocr.occasion,
        recipient:      ocr.recipient,
        sender:         ocr.sender,
        all_text:       ocr.all_text,
        ocr_raw:        ocr as never,
        ocr_confidence: ocr.confidence,
        ocr_done:       true,
      } as never)
      .eq("id", docId);
  } catch (err) {
    // OCR 失敗でもファイルは保存済み
    await supabase
      .from("fuda_documents" as never)
      .update({
        ocr_done:  true,
        ocr_error: String(err),
      } as never)
      .eq("id", docId);
  }

  return { id: docId };
}

// ── 公開 Server Action: 1ファイルアップロード ───────
export async function uploadFudaPdf(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "ファイルが選択されていません" };

  const result = await processSingleFile(supabase, file, user.id);
  revalidatePath("/admin/fuda");
  return result;
}

// ── 公開 Server Action: OCR 再実行 ──────────────────
export async function rerunFudaOcr(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  // 既存レコード取得
  const { data: doc } = await supabase
    .from("fuda_documents" as never)
    .select("storage_path, file_name")
    .eq("id", id)
    .single() as { data: { storage_path: string; file_name: string } | null };

  if (!doc) return { error: "立て札が見つかりません" };

  // ストレージからファイル取得
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    return { error: "ファイルのダウンロードに失敗しました" };
  }

  // OCR 再実行
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const ocr = await runGeminiOcr(arrayBuffer);
    await supabase
      .from("fuda_documents" as never)
      .update({
        occasion:       ocr.occasion,
        recipient:      ocr.recipient,
        sender:         ocr.sender,
        all_text:       ocr.all_text,
        ocr_raw:        ocr as never,
        ocr_confidence: ocr.confidence,
        ocr_done:       true,
        ocr_error:      null,
      } as never)
      .eq("id", id);
  } catch (err) {
    return { error: String(err) };
  }

  revalidatePath(`/admin/fuda/${id}`);
  revalidatePath("/admin/fuda");
  return {};
}

// ── 公開 Server Action: 削除（管理者のみ） ──────────
export async function deleteFudaDocument(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "管理者権限が必要です" };

  // ストレージパス取得
  const { data: doc } = await supabase
    .from("fuda_documents" as never)
    .select("storage_path")
    .eq("id", id)
    .single() as { data: { storage_path: string } | null };

  if (doc) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  }

  await supabase
    .from("fuda_documents" as never)
    .delete()
    .eq("id", id);

  revalidatePath("/admin/fuda");
  return {};
}
