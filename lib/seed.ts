import type { StockItem } from './types';

/** 開封日・期限をデモ実行日を基準に生成する（シードが古びないようにするため） */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysLater(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

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
    form: '錠剤',
    ingredients: ['フェキソフェナジン塩酸塩'],
    status: '残14日分',
    isPrescription: true,
    remaining: { count: 28, unit: '錠' },
    dose: { times: ['朝', '夜'], perTime: 1 },
    expiresAt: daysLater(120),
  },
  {
    id: 'stk-002',
    name: 'イブA錠',
    category: '市販薬・サプリ',
    form: '錠剤',
    ingredients: ['イブプロフェン', 'アリルイソプロピルアセチル尿素'],
    status: '残12錠',
    isPrescription: false,
    remaining: { count: 12, unit: '錠' },
    expiresAt: daysLater(400),
  },
  {
    id: 'stk-003',
    name: 'ヒルドイドローション（処方）',
    category: '処方薬(外用)',
    form: 'ローション',
    ingredients: ['ヘパリン類似物質'],
    status: '使用中・顔',
    isPrescription: true,
    bodyPart: '顔',
    routine: 'outbath',
    openedAt: daysAgo(40),
  },
  {
    id: 'stk-004',
    name: 'ベタメタゾン吉草酸エステル軟膏（処方）',
    category: '処方薬(外用)',
    form: '軟膏',
    ingredients: ['ベタメタゾン吉草酸エステル'],
    status: '使用中・顔',
    isPrescription: true,
    bodyPart: '顔',
    routine: 'outbath',
    openedAt: daysAgo(25),
  },
  {
    id: 'stk-005',
    name: 'ナイアシンアミド美容液',
    category: 'スキンケア',
    form: '美容液',
    ingredients: ['ナイアシンアミド', 'グリセリン'],
    status: '開封2ヶ月',
    isPrescription: false,
    routine: 'outbath',
    openedAt: daysAgo(62),
  },
  {
    id: 'stk-006',
    name: 'しっとり化粧水',
    category: 'スキンケア',
    form: '化粧水',
    ingredients: ['グリセリン', 'BG'],
    status: '開封1ヶ月',
    isPrescription: false,
    routine: 'outbath',
    openedAt: daysAgo(33),
  },
  {
    id: 'stk-007',
    name: 'アミノ酸系シャンプー',
    category: 'ヘアケア',
    form: 'シャンプー',
    ingredients: ['ココイルグルタミン酸TEA', 'コカミドプロピルベタイン'],
    status: '使用中',
    isPrescription: false,
    routine: 'inbath',
    openedAt: daysAgo(70),
  },
  {
    id: 'stk-008',
    name: 'モイストトリートメント',
    category: 'ヘアケア',
    form: 'トリートメント',
    ingredients: ['ベヘントリモニウムクロリド', 'シア脂'],
    status: '使用中',
    isPrescription: false,
    routine: 'inbath',
    openedAt: daysAgo(70),
  },
  {
    id: 'stk-009',
    name: 'アミノ酸洗顔フォーム',
    category: 'スキンケア',
    form: '洗顔',
    ingredients: ['ラウロイルグルタミン酸Na', 'グリセリン'],
    status: '使用中',
    isPrescription: false,
    routine: 'inbath',
    openedAt: daysAgo(20),
  },
  {
    id: 'stk-010',
    name: '低刺激ボディソープ',
    category: 'ボディケア',
    form: 'ボディソープ',
    ingredients: ['ラウロイルメチルアラニンNa', 'グリチルリチン酸2K'],
    status: '使用中',
    isPrescription: false,
    routine: 'inbath',
    openedAt: daysAgo(95),
  },
];

/** マイストック画面の表示順 — §9.2 */
export const CATEGORY_ORDER = [
  '処方薬',
  '処方薬(外用)',
  '市販薬・サプリ',
  'スキンケア',
  'ヘアケア',
  'ボディケア',
] as const;
