import {
  Bandage,
  Bath,
  Droplets,
  Pill,
  ShowerHead,
  Sparkles,
  Tablets,
  type LucideIcon,
} from 'lucide-react';
import type { Signal, StockCategory } from './types';

/**
 * 表示トークンの集約 — カテゴリとシグナルの見た目をここで一元管理する。
 * Tailwind の JIT が拾えるよう、クラス名は完全な文字列で持つ（動的生成しない）。
 */

export const CATEGORY_STYLE: Record<
  StockCategory,
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
