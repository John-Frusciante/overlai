import type { BuiltinCategory, StockCategory, StockItem } from './types';

/**
 * カテゴリの扱い — 設計仕様書 §9.2
 *
 * 組み込みの6区分に、ユーザーが作ったカテゴリを足せる。
 * 判定プロンプトはカテゴリ名で分岐していない（処方薬かどうかは `isPrescription` で判断する）ため、
 * 名前が増えても判定の挙動は変わらない。
 */

/** 表示順の基準。ここに無いものはユーザーが作ったカテゴリとして後ろに並ぶ */
export const BUILTIN_CATEGORIES: BuiltinCategory[] = [
  '処方薬',
  '処方薬(外用)',
  '市販薬・サプリ',
  'スキンケア',
  'ヘアケア',
  'ボディケア',
];

export function isBuiltin(name: string): boolean {
  return (BUILTIN_CATEGORIES as string[]).includes(name);
}

export const MAX_CATEGORY_LENGTH = 12;

/** 前後の空白を落とし、連続する空白を1つにまとめる */
export function normalizeCategoryName(raw: string): string {
  return raw.replace(/[\s　]+/g, ' ').trim();
}

/**
 * 追加してよい名前かを調べる。
 * 弾く理由をそのまま画面に出せるよう、文字列で返す。
 */
export function validateCategoryName(
  raw: string,
  existing: string[],
): { ok: true; name: string } | { ok: false; reason: string } {
  const name = normalizeCategoryName(raw);
  if (!name) return { ok: false, reason: '名前を入力してください' };
  if ([...name].length > MAX_CATEGORY_LENGTH) {
    return { ok: false, reason: `${MAX_CATEGORY_LENGTH}文字までにしてください` };
  }
  if (isBuiltin(name)) return { ok: false, reason: 'もとからあるカテゴリです' };
  if (existing.some((e) => e === name)) return { ok: false, reason: 'すでにあります' };
  return { ok: true, name };
}

/**
 * 画面に並べるカテゴリを決める。
 *
 * 組み込み → ユーザーが追加したもの → **在庫にしか存在しない名前** の順。
 * 3つ目を入れているのは、カテゴリを消しても中身が一覧から消えないようにするため。
 */
export function orderedCategories(custom: string[], items: StockItem[]): string[] {
  const out: string[] = [...BUILTIN_CATEGORIES];
  for (const c of custom) if (!out.includes(c)) out.push(c);
  for (const i of items) if (!out.includes(i.category)) out.push(i.category);
  return out;
}

/** そのカテゴリを使っている在庫の件数 */
export function countIn(items: StockItem[], category: StockCategory): number {
  return items.filter((i) => i.category === category).length;
}
