/**
 * Shared EXIF-aware image compression for card scanning.
 * Resizes to fit within Anthropic's no-resize envelope (long edge ≤1568px, ≤1.15MP)
 * so Claude Vision doesn't auto-downscale server-side.
 */

// ─── EXIF helpers ───

function getExifOrientation(buf: ArrayBuffer): number {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return 1;
  let o = 2;
  while (o + 4 < v.byteLength) {
    const marker = v.getUint16(o);
    const len = v.getUint16(o + 2);
    if (marker === 0xFFE1 && v.byteLength > o + 10) {
      const le = v.getUint16(o + 10) === 0x4949;
      const ifd = v.getUint32(o + 14, le);
      const base = o + 10;
      if (base + ifd + 2 > v.byteLength) break;
      const entries = v.getUint16(base + ifd, le);
      for (let i = 0; i < entries; i++) {
        const entry = base + ifd + 2 + i * 12;
        if (entry + 12 > v.byteLength) break;
        if (v.getUint16(entry, le) === 0x0112) return v.getUint16(entry + 8, le);
      }
    }
    if (len < 2) break;
    o += 2 + len;
  }
  return 1;
}

function applyExifTransform(ctx: CanvasRenderingContext2D, o: number, w: number, h: number) {
  const t: Record<number, () => void> = {
    2: () => ctx.transform(-1, 0, 0, 1, w, 0),
    3: () => ctx.transform(-1, 0, 0, -1, w, h),
    4: () => ctx.transform(1, 0, 0, -1, 0, h),
    5: () => ctx.transform(0, 1, 1, 0, 0, 0),
    6: () => ctx.transform(0, 1, -1, 0, h, 0),
    7: () => ctx.transform(0, -1, -1, 0, h, w),
    8: () => ctx.transform(0, -1, 1, 0, 0, w),
  };
  t[o]?.();
}

// ─── Main compress function ───

interface CompressOptions {
  maxLongEdge?: number;
  maxPixels?: number;
  quality?: number;
}

export function compressImage(
  file: File,
  opts?: CompressOptions
): Promise<string> {
  const maxLongEdge = opts?.maxLongEdge ?? 1568;
  const maxPixels = opts?.maxPixels ?? 1_150_000;
  const quality = opts?.quality ?? 0.85;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        let orientation = 1;
        try { orientation = getExifOrientation(arrayBuffer); } catch (exifErr) { console.warn("[scan] EXIF parse failed:", exifErr instanceof Error ? exifErr.message : exifErr); }
        const blob = new Blob([arrayBuffer], { type: file.type });
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
        img.onload = () => {
          URL.revokeObjectURL(url);
          const swap = orientation >= 5 && orientation <= 8;
          let srcW = img.naturalWidth, srcH = img.naturalHeight;
          if (swap) [srcW, srcH] = [srcH, srcW];

          // Scale to fit within long-edge limit
          let scale = Math.min(1, maxLongEdge / Math.max(srcW, srcH));
          let w = Math.round(srcW * scale);
          let h = Math.round(srcH * scale);

          // Further scale if total pixels exceed megapixel cap
          if (w * h > maxPixels) {
            const pixelScale = Math.sqrt(maxPixels / (w * h));
            w = Math.round(w * pixelScale);
            h = Math.round(h * pixelScale);
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          applyExifTransform(ctx, orientation, w, h);
          ctx.drawImage(img, 0, 0, swap ? h : w, swap ? w : h);
          resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
        };
        img.src = url;
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}
