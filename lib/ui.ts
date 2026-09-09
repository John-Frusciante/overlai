import {
  Bandage,
  Bath,
  Droplets,
  Pill,
  ShowerHead,
  Sparkles,
  Tablets,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import type { BuiltinCategory, Signal, StockCategory } from './types';
import { isBuiltin } from './categories';

/**
 * 表示トークンの集約 — カテゴリとシグナルの見た目をここで一元管理する。
 * Tailwind の JIT が拾えるよう、クラス名は完全な文字列で持つ（動的生成しない）。
 */

export const CATEGORY_STYLE: Record<
  BuiltinCategory,
  { icon: LucideIcon; text: string; bg: string; ring: string; label: string }
> = {
  処方薬: {
    icon: Pill,
    text: 'text-[#4f46e5]',
    bg: 'bg-[#4f46e5]/8',
    ring: 'ring-[#4f46e5]/15',
    label: '処方薬',
  },
  '処方薬(外用)': {
    icon: Bandage,
    text: 'text-[#0d9488]',
    bg: 'bg-[#0d9488]/8',
    ring: 'ring-[#0d9488]/15',
    label: '処方薬（外用）',
  },
  '市販薬・サプリ': {
    icon: Tablets,
    text: 'text-[#b45309]',
    bg: 'bg-[#b45309]/8',
    ring: 'ring-[#b45309]/15',
    label: '市販薬・サプリ',
  },
  スキンケア: {
    icon: Sparkles,
    text: 'text-[#be185d]',
    bg: 'bg-[#be185d]/8',
    ring: 'ring-[#be185d]/15',
    label: 'スキンケア',
  },
  ヘアケア: {
    icon: ShowerHead,
    text: 'text-[#7c3aed]',
    bg: 'bg-[#7c3aed]/8',
    ring: 'ring-[#7c3aed]/15',
    label: 'ヘアケア',
  },
  ボディケア: {
    icon: Bath,
    text: 'text-[#15803d]',
    bg: 'bg-[#15803d]/8',
    ring: 'ring-[#15803d]/15',
    label: 'ボディケア',
  },
};

/** 剤形が不明なときのフォールバック */
export const FALLBACK_ICON = Droplets;

/**
 * ユーザーが追加したカテゴリの配色。
 * Tailwind の JIT がクラス名を拾えるよう、完全な文字列で持つ（動的に組み立てない）。
 * 組み込みの6色とも、判定の3色とも重ならない色を選んでいる。
 */
const CUSTOM_PALETTE: Array<{ text: string; bg: string; ring: string }> = [
  { text: 'text-[#0369a1]', bg: 'bg-[#0369a1]/8', ring: 'ring-[#0369a1]/15' },
  { text: 'text-[#a21caf]', bg: 'bg-[#a21caf]/8', ring: 'ring-[#a21caf]/15' },
  { text: 'text-[#0f766e]', bg: 'bg-[#0f766e]/8', ring: 'ring-[#0f766e]/15' },
  { text: 'text-[#a16207]', bg: 'bg-[#a16207]/8', ring: 'ring-[#a16207]/15' },
  { text: 'text-[#4d7c0f]', bg: 'bg-[#4d7c0f]/8', ring: 'ring-[#4d7c0f]/15' },
  { text: 'text-[#57534e]', bg: 'bg-[#57534e]/8', ring: 'ring-[#57534e]/15' },
];

/** 名前から色を決める。同じ名前なら常に同じ色になるようにする */
function paletteFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 100_000;
  return CUSTOM_PALETTE[h % CUSTOM_PALETTE.length];
}

/**
 * カテゴリの見た目を返す。組み込みでも、ユーザーが追加したものでも必ず値が返る。
 * `CATEGORY_STYLE[name]` を直接引くと、追加されたカテゴリで undefined になるため
 * 表示側はこちらを使うこと。
 */
export function categoryStyle(name: StockCategory): {
  icon: LucideIcon;
  text: string;
  bg: string;
  ring: string;
  label: string;
} {
  if (isBuiltin(name)) return CATEGORY_STYLE[name as BuiltinCategory];
  return { icon: Tag, ...paletteFor(name), label: name };
}

/**
 * 判定シグナル — 設計仕様書 §9.4 の指定値。
 * yellow は視認性のため黄色ではなくアンバーを使う。
 */
export const SIGNAL_ORDER: Signal[] = ['blue', 'yellow', 'red'];

export const SIGNAL_STYLE: Record<
  Signal,
  { base: string; deep: string; chip: string; ring: string }
> = {
  blue: {
    base: '#2563EB',
    deep: '#1D4ED8',
    chip: 'bg-[#2563EB]/10 text-[#1D4ED8]',
    ring: 'ring-[#2563EB]/20',
  },
  yellow: {
    base: '#D97706',
    deep: '#B45309',
    chip: 'bg-[#D97706]/10 text-[#B45309]',
    ring: 'ring-[#D97706]/20',
  },
  red: {
    base: '#DC2626',
    deep: '#B91C1C',
    chip: 'bg-[#DC2626]/10 text-[#B91C1C]',
    ring: 'ring-[#DC2626]/20',
  },
};

/**
 * Overlai のシンボル。重なる2つの角丸矩形＝プロダクト名 Overlay の由来。
 * PWAアイコンと同じモチーフで、判定カードのシグナル表現にも使う。
 */
export function overlaySymbolPath(): { a: string; b: string } {
  return {
    a: 'M14 14 h30 a10 10 0 0 1 10 10 v30 a10 10 0 0 1 -10 10 h-30 a10 10 0 0 1 -10 -10 v-30 a10 10 0 0 1 10 -10 z',
    b: 'M36 36 h30 a10 10 0 0 1 10 10 v30 a10 10 0 0 1 -10 10 h-30 a10 10 0 0 1 -10 -10 v-30 a10 10 0 0 1 10 -10 z',
  };
}
