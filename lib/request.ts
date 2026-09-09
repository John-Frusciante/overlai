import type { DoseTime, Profile, ScalpType, SkinType, StockItem } from './types';

/** リクエスト入力の検証 — 設計仕様書 §8.3（クライアント由来の入力として扱う） */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_STOCK_ITEMS = 50;
export const MAX_FIELD_LEN = 200;

export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** data URL を Vision 入力用に分解する */
export function parseDataUrl(image: unknown): { mediaType: MediaType; data: string } | null {
  if (typeof image !== 'string') return null;
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) return null;
  const data = m[2];
  // base64 は元データの約4/3のサイズになる
  if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  return { mediaType: m[1] as MediaType, data };
}

const clip = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_FIELD_LEN) : '');

/** 在庫はプロンプトへ結合される経路にあるため、件数と長さを制限する */
export function sanitizeStock(input: unknown): StockItem[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (input.length > MAX_STOCK_ITEMS) return null;

  return input.map((raw) => {
    const item = raw as Partial<StockItem>;
    return {
      id: clip(item.id),
      name: clip(item.name),
      category: clip(item.category) as StockItem['category'],
      form: clip(item.form) as StockItem['form'],
      ingredients: Array.isArray(item.ingredients)
        ? item.ingredients.slice(0, 30).map(clip).filter(Boolean)
        : [],
      status: clip(item.status),
      isPrescription: Boolean(item.isPrescription),
      bodyPart: item.bodyPart ? clip(item.bodyPart) : undefined,
      // ルーティン助言では「洗う／塗る」と服薬の設定まで使う。
      // 判定（/api/analyze）はプロンプトに渡す項目を明示しているため、
      // ここで項目が増えても判定の入力は変わらない。
      routine:
        item.routine === 'inbath' || item.routine === 'outbath' ? item.routine : undefined,
      dose: sanitizeDose(item.dose),
      // 順序はサーバー側で組み直すので、手で決めた並びもここを通す必要がある
      routineOrder:
        typeof item.routineOrder === 'number' && Number.isFinite(item.routineOrder)
          ? item.routineOrder
          : undefined,
    };
  });
}

const DOSE_TIMES: DoseTime[] = ['朝', '昼', '夜'];

function sanitizeDose(input: unknown): StockItem['dose'] {
  if (!input || typeof input !== 'object') return undefined;
  const dose = input as Partial<NonNullable<StockItem['dose']>>;
  if (!Array.isArray(dose.times)) return undefined;
  const times = DOSE_TIMES.filter((t) => dose.times!.includes(t));
  if (times.length === 0) return undefined;
  const perTime = Number(dose.perTime);
  return { times, perTime: Number.isFinite(perTime) ? Math.max(1, Math.round(perTime)) : 1 };
}

const SKINS: SkinType[] = ['乾燥', '脂性', '混合', '敏感', '普通'];
const SCALPS: ScalpType[] = ['乾燥', '脂性', 'ふけ・かゆみ', '普通'];

/** 肌質・頭皮の自己申告。想定外の値はプロンプトに混ぜず落とす */
export function sanitizeProfile(input: unknown): Profile {
  if (!input || typeof input !== 'object') return {};
  const p = input as Partial<Profile>;
  return {
    skin: SKINS.find((s) => s === p.skin),
    scalp: SCALPS.find((s) => s === p.scalp),
  };
}
