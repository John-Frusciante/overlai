/** 送信前に長辺を 1568px 以下へ落とす — 設計仕様書 NFR-02 */
const MAX_EDGE = 1568;
const QUALITY = 0.85;

export async function toResizedDataUrl(source: Blob): Promise<string> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context を取得できませんでした');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', QUALITY);
}

// ── ガイド枠の切り抜き ────────────────────────────────────────────────

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 画面のガイド枠を、映像側の座標に移す。
 *
 * **枠に入れてもらったのに全画面を送っていた**のを直すために要る。
 * 撮った画像は長辺 1568px に縮めてから送るので、成分表示が画面の一角にしか
 * 写っていないと、送る頃には文字が潰れる。実測でも、927×1200 の画像で本文が
 * 小さいと Azure 経路は何も読めず、同じ内容を大きく写した 1600px なら全成分読めた。
 * 枠の中だけを切り出せば、同じ 1568px の枠に文字が大きく収まる。
 *
 * video は object-cover で表示している。要素より映像のほうが大きく描かれ、
 * はみ出した分は左右（または上下）が均等に切れているので、その分を戻して換算する。
 */
export function coverCrop(
  video: { width: number; height: number },
  display: { x: number; y: number; width: number; height: number },
  guide: { x: number; y: number; width: number; height: number },
  /** 枠のきわで切れないよう、少し広めに取る */
  padding = 0.06,
): CropRect | null {
  if (video.width <= 0 || video.height <= 0 || display.width <= 0 || display.height <= 0) {
    return null;
  }

  const scale = Math.max(display.width / video.width, display.height / video.height);
  const drawnW = video.width * scale;
  const drawnH = video.height * scale;
  const offsetX = display.x + (display.width - drawnW) / 2;
  const offsetY = display.y + (display.height - drawnH) / 2;

  const padX = (guide.width * padding) / scale;
  const padY = (guide.height * padding) / scale;

  const x = (guide.x - offsetX) / scale - padX;
  const y = (guide.y - offsetY) / scale - padY;
  const width = guide.width / scale + padX * 2;
  const height = guide.height / scale + padY * 2;

  return clamp({ x, y, width, height }, video.width, video.height);
}

function clamp(rect: CropRect, maxW: number, maxH: number): CropRect | null {
  const x = Math.max(0, Math.min(rect.x, maxW));
  const y = Math.max(0, Math.min(rect.y, maxH));
  const width = Math.min(rect.width, maxW - x);
  const height = Math.min(rect.height, maxH - y);
  // 極端に小さい切り抜きは、枠の計算が壊れている合図。全画面に戻す
  if (width < 64 || height < 64) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
