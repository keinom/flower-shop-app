"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadOrderPhoto, deleteOrderPhoto } from "@/app/admin/orders/[id]/actions";

interface Photo {
  id: string;
  storage_path: string;
  file_name: string;
  public_url: string;
  created_at: string;
}

interface Props {
  orderId: string;
  photos: Photo[];
}

export function OrderPhotoPanel({ orderId, photos }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("order_id", orderId);
        fd.set("file", file);
        const result = await uploadOrderPhoto(fd);
        if (result?.error) {
          setErrorMsg(result.error);
          break;
        }
      }
      router.refresh();
    } catch (err) {
      setErrorMsg(`予期しないエラーが発生しました: ${String(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = (photo: Photo) => {
    if (!confirm(`「${photo.file_name}」を削除しますか？`)) return;
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("photo_id", photo.id);
    fd.set("storage_path", photo.storage_path);
    startTransition(async () => {
      const result = await deleteOrderPhoto(fd);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        router.refresh();
      }
    });
    if (lightbox?.id === photo.id) setLightbox(null);
  };

  const isLoading = uploading || isPending;

  return (
    <>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">写真</h2>
            <p className="text-xs text-gray-400 mt-0.5">{photos.length} 枚</p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                アップロード中...
              </span>
            ) : (
              "+ 写真を追加"
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* エラーメッセージ */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors flex flex-col items-center gap-2 disabled:cursor-not-allowed"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm font-medium">クリックして写真をアップロード</span>
            <span className="text-xs">JPG・PNG・HEIC など対応</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setLightbox(photo)}
                  className="block w-full aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-brand-300 transition-colors"
                >
                  <img
                    src={photo.public_url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  disabled={isPending}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                  title="削除"
                >
                  ✕
                </button>
                <p className="text-xs text-gray-400 mt-1 truncate px-0.5" title={photo.file_name}>
                  {new Date(photo.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  {" "}
                  {new Date(photo.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ライトボックス */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.public_url}
              alt={lightbox.file_name}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-white/70 text-sm truncate">{lightbox.file_name}</p>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDelete(lightbox)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  削除
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="text-white/70 hover:text-white transition-colors text-sm"
                >
                  ✕ 閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
