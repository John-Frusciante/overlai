import type { CleanserBase, CleanserMatch, ItemForm, Profile, StockItem } from './types';

/**
 * 洗浄基剤 × 肌質・頭皮の相性判定 — 企画書 §6 機能一覧13番
 *
 * AIを使わずルールベースで組む。洗浄成分の系統は成分名から一意に決まり、
 * 相性も系統と肌質の組み合わせで決まるため、推論を挟む必要がない。
 *
 * 断定はせず「〜の可能性があります」で統一する（設計仕様書 §12）。
 * 肌質はユーザーの自己申告であり、診断ではない。
 */

/** 洗浄料とみなす剤形 */
const CLEANSER_FORMS: ItemForm[] = ['シャンプー', '洗顔', 'ボディソープ'];

export function isCleanser(item: { form: ItemForm }): boolean {
  return CLEANSER_FORMS.includes(item.form);
}

/**
 * 成分名から洗浄基剤の系統を判定する。
 * 全成分表示は配合量の多い順に並ぶため、先に現れたものを主剤とみなす。
 */
const BASE_KEYWORDS: Array<{ base: CleanserBase; keys: string[] }> = [
  {
    base: '高級アルコール系',
    keys: ['ラウレス硫酸', 'ラウリル硫酸', 'ミリスチル硫酸', 'オレフィン(C14-16)スルホン酸'],
  },
  {
    base: 'アミノ酸系',
    keys: [
      'ココイルグルタミン酸',
      'ラウロイルグルタミン酸',
      'ココイルメチルタウリン',
      'ラウロイルメチルアラニン',
      'ココイルアラニン',
      'ココイルグリシン',
      'ラウロイルアスパラギン酸',
    ],
  },
  {
    base: '石鹸系',
    keys: ['石ケン素地', 'カリ石ケン素地', '脂肪酸Na', '脂肪酸K', 'ラウリン酸Na', 'ミリスチン酸K', 'ミリスチン酸Na'],
  },
  {
    base: 'ベタイン系',
    keys: ['コカミドプロピルベタイン', 'ラウラミドプロピルベタイン', 'コカミドDEA'],
  },
];

export function classifyCleanser(ingredients: string[]): {
  base: CleanserBase;
  ingredient: string | null;
} {
  // 配合順を尊重し、先に見つかった主剤を採用する
  for (const ing of ingredients) {
    for (const { base, keys } of BASE_KEYWORDS) {
      const key = keys.find((k) => ing.includes(k));
      if (key) return { base, ingredient: ing };
    }
  }
  return { base: '不明', ingredient: null };
}

/**
 * 相性ルール。
 * 「肌に良い／悪い」ではなく「洗浄力が強い／おだやか」という性質と、
 * ユーザーが申告した状態との噛み合わせだけを述べる。
 */
function judgeSkin(base: CleanserBase, skin: Profile['skin']): Omit<CleanserMatch, 'base' | 'ingredient'> | null {
  if (!skin) return null;

  if (base === '高級アルコール系') {
    if (skin === '乾燥' || skin === '敏感')
      return {
        level: 'caution',
        message: `洗浄力が強い系統です。${skin}肌では必要な皮脂まで落ちて、つっぱりや刺激につながる可能性があります。`,
      };
    if (skin === '脂性')
      return { level: 'good', message: '洗浄力が強い系統です。皮脂が気になる肌には合いやすい傾向があります。' };
  }

  if (base === '石鹸系') {
    if (skin === '乾燥' || skin === '敏感')
      return {
        level: 'caution',
        message: 'さっぱり洗えますがアルカリ性です。乾燥や刺激を感じる場合は、弱酸性のものに替える選択肢があります。',
      };
    if (skin === '脂性')
      return { level: 'good', message: 'さっぱり洗える系統です。皮脂が気になる肌には合いやすい傾向があります。' };
  }

  if (base === 'アミノ酸系' || base === 'ベタイン系') {
    if (skin === '乾燥' || skin === '敏感')
      return { level: 'good', message: '洗浄力がおだやかな系統です。乾燥や刺激が気になる肌に向いています。' };
    if (skin === '脂性')
      return {
        level: 'caution',
        message: '洗浄力がおだやかな系統です。皮脂が多い場合は洗い上がりが物足りない可能性があります。',
      };
  }

  return null;
}

function judgeScalp(base: CleanserBase, scalp: Profile['scalp']): Omit<CleanserMatch, 'base' | 'ingredient'> | null {
  if (!scalp) return null;

  if (base === '高級アルコール系') {
    if (scalp === '乾燥' || scalp === 'ふけ・かゆみ')
      return {
        level: 'caution',
        message: `洗浄力が強い系統です。${scalp === '乾燥' ? '乾燥した頭皮' : 'ふけ・かゆみがある頭皮'}では刺激になる可能性があります。`,
      };
    if (scalp === '脂性')
      return { level: 'good', message: '洗浄力が強い系統です。皮脂が多い頭皮には合いやすい傾向があります。' };
  }

  if (base === 'アミノ酸系' || base === 'ベタイン系') {
    if (scalp === '乾燥' || scalp === 'ふけ・かゆみ')
      return { level: 'good', message: '洗浄力がおだやかな系統です。頭皮への負担を抑えたい場合に向いています。' };
    if (scalp === '脂性')
      return {
        level: 'caution',
        message: '洗浄力がおだやかな系統です。皮脂が多い場合は洗い上がりが物足りない可能性があります。',
      };
  }

  return null;
}

/**
 * 洗浄料と肌質・頭皮の相性を返す。
 * シャンプーは頭皮、洗顔・ボディソープは肌質で判断する。
 */
export function matchCleanser(
  item: { form: ItemForm; ingredients: string[] },
  profile: Profile,
): CleanserMatch | null {
  if (!isCleanser(item)) return null;

  const { base, ingredient } = classifyCleanser(item.ingredients);
  if (base === '不明') return null;

  const judged =
    item.form === 'シャンプー' ? judgeScalp(base, profile.scalp) : judgeSkin(base, profile.skin);

  if (!judged) {
    return {
      base,
      ingredient,
      level: 'neutral',
      message:
        base === 'アミノ酸系' || base === 'ベタイン系'
          ? '洗浄力がおだやかな系統です。'
          : '洗浄力が強い系統です。',
    };
  }

  return { base, ingredient, ...judged };
}

/** 在庫のうち洗浄料だけを相性つきで返す */
export function cleansersWithMatch(
  stock: StockItem[],
  profile: Profile,
): Array<{ item: StockItem; match: CleanserMatch }> {
  return stock
    .filter(isCleanser)
    .map((item) => ({ item, match: matchCleanser(item, profile) }))
    .filter((x): x is { item: StockItem; match: CleanserMatch } => x.match !== null);
}
