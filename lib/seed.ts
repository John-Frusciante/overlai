import type { StockItem } from './types';

/**
 * デモ用シードデータ — 設計仕様書 §6.2
 *
 * ⚠ 内服薬に処方NSAIDsを置いてはならない。
 * 処方のロキソプロフェン等が在庫にあると、市販イブプロフェン製剤のスキャンが
 * 「NSAIDsの重複投与＝過量摂取リスク」として🔴の条件にも該当し、
 * デモの主役である🟡判定が不安定になる（§7.4 決定表の優先1）。
 * stk-001 を抗アレルギー薬にしてあるのはこのため。
 */
export const SEED_STOCK: StockItem[] = [
  {
    id: 'stk-001',
    name: 'フェキソフェナジン塩酸塩錠60mg（処方）',
    category: '処方薬',
    ingredients: ['フェキソフェナジン塩酸塩'],
    status: '残14日分',
    isPrescription: true,
  },
  {
    id: 'stk-002',
    name: 'イブA錠',
    category: '市販薬・サプリ',
    ingredients: ['イブプロフェン', 'アリルイソプロピルアセチル尿素'],
    status: '残12錠',
    isPrescription: false,
  },
  {
    id: 'stk-003',
    name: 'ヒルドイドローション（処方）',
    category: '処方薬(外用)',
    ingredients: ['ヘパリン類似物質'],
    status: '使用中・顔',
    isPrescription: true,
    bodyPart: '顔',
  },
  {
    id: 'stk-004',
    name: 'ベタメタゾン吉草酸エステル軟膏（処方）',
    category: '処方薬(外用)',
    ingredients: ['ベタメタゾン吉草酸エステル'],
    status: '使用中・顔',
    isPrescription: true,
    bodyPart: '顔',
  },
  {
    id: 'stk-005',
    name: 'ナイアシンアミド美容液',
    category: 'スキンケア',
    ingredients: ['ナイアシンアミド', 'グリセリン'],
    status: '開封2ヶ月',
    isPrescription: false,
  },
  {
    id: 'stk-006',
    name: 'しっとり化粧水',
    category: 'スキンケア',
    ingredients: ['グリセリン', 'BG'],
    status: '開封1ヶ月',
    isPrescription: false,
  },
  {
    id: 'stk-007',
    name: 'アミノ酸系シャンプー',
    category: 'ヘアケア',
    ingredients: ['ココイルグルタミン酸TEA', 'コカミドプロピルベタイン'],
    status: '使用中',
    isPrescription: false,
  },
];

/** マイストック画面の表示順 — §9.2 */
export const CATEGORY_ORDER = [
  '処方薬',
  '処方薬(外用)',
  '市販薬・サプリ',
  'スキンケア',
  'ヘアケア',
] as const;
