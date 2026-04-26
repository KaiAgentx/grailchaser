import { createClient } from "@/lib/supabase";

const BUCKET = "card-scans";
const MAX_LONG_EDGE = 1024;
const JPEG_QUALITY = 0.85;

export async function compressForStorage(file: File): Promise<Blob> {
  // createImageBitmap honors EXIF orientation natively when imageOrientation: "from-image"
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width: srcW, height: srcH } = bitmap;

  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("canvas 2d context unavailable");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("canvas toBlob returned null");
  return blob;
}

export async function uploadCardScan(
  userId: string,
  cardId: string,
  side: "front" | "back",
  file: File,
): Promise<string | null> {
  try {
    const compressed = await compressForStorage(file);
    const path = `${userId}/${cardId}/${side}.jpg`;
    const sb = createClient();
    const { error } = await sb.storage.from(BUCKET).upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) {
      console.error("[userScanStorage] upload failed:", side, error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error("[userScanStorage] upload threw:", side, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function uploadCardScansAsync(
  userId: string,
  cardId: string,
  front: File,
  back: File | null,
): Promise<void> {
  const [frontPath, backPath] = await Promise.all([
    uploadCardScan(userId, cardId, "front", front),
    back ? uploadCardScan(userId, cardId, "back", back) : Promise.resolve(null),
  ]);

  const updates: Record<string, string | null> = {};
  if (frontPath) updates.user_scan_front_url = frontPath;
  if (backPath) updates.user_scan_back_url = backPath;
  if (Object.keys(updates).length === 0) return;
  updates.user_scan_replaced_at = new Date().toISOString();

  const sb = createClient();
  const { error } = await sb.from("cards").update(updates).eq("id", cardId);
  if (error) console.error("[userScanStorage] cards update failed:", error.message);
}

export async function getSignedScanUrl(path: string): Promise<string | null> {
  try {
    const sb = createClient();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) {
      console.error("[userScanStorage] signed URL failed:", error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (err) {
    console.error("[userScanStorage] signed URL threw:", err instanceof Error ? err.message : err);
    return null;
  }
}
