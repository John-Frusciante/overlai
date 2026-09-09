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
 *
 * 系統ごとに分岐を書き下すと組み合わせが抜けやすい（頭皮側で石鹸系が抜けていた）。
 * 洗浄力の強さに畳んでから、肌質・頭皮のすべての値を必ず埋める。
 */
/** 主剤が判定できた系統。'不明' は matchCleanser で先に弾く */
type KnownBase = Exclude<CleanserBase, '不明'>;

type Strength = 'strong' | 'mild';

const STRENGTH: Record<KnownBase, Strength> = {
  高級アルコール系: 'strong',
  石鹸系: 'strong',
  アミノ酸系: 'mild',
  ベタイン系: 'mild',
};

type Verdict = Omit<CleanserMatch, 'base' | 'ingredient'>;

function judgeSkin(base: KnownBase, skin: Profile['skin']): Verdict | null {
  if (!skin) return null;

  const strong = STRENGTH[base] === 'strong';
  // 石鹸系は洗浄力の強さとは別に、アルカリ性であることが効いてくる
  const soap = base === '石鹸系';

  switch (skin) {
    case '乾燥':
    case '敏感':
      if (!strong)
        return {
          level: 'good',
          message: '洗浄力がおだやかな系統です。乾燥や刺激が気になる肌に向いています。',
        };
      return {
        level: 'caution',
        message: soap
          ? 'さっぱり洗えますがアルカリ性です。乾燥や刺激を感じる場合は、弱酸性のものに替える選択肢があります。'
          : `洗浄力が強い系統です。${skin}肌では必要な皮脂まで落ちて、つっぱりや刺激につながる可能性があります。`,
      };

    case '脂性':
      if (!strong)
        return {
          level: 'caution',
          message:
            '洗浄力がおだやかな系統です。皮脂が多い場合は洗い上がりが物足りない可能性があります。',
        };
      return {
        level: 'good',
        message: soap
          ? 'さっぱり洗える系統です。皮脂が気になる肌には合いやすい傾向があります。'
          : '洗浄力が強い系統です。皮脂が気になる肌には合いやすい傾向があります。',
      };

    // 部位によって状態が違うため、片側だけを見て良し悪しを言わない
    case '混合':
      return strong
        ? {
            level: 'neutral',
            message:
              '洗浄力が強い系統です。皮脂の多い部分には合う一方、乾燥しやすい部分ではつっぱりを感じる可能性があります。',
          }
        : {
            level: 'good',
            message:
              '洗浄力がおだやかな系統です。乾燥しやすい部分に負担をかけにくい傾向があります。',
          };

    case '普通':
      return strong
        ? {
            level: 'neutral',
            message:
              '洗浄力が強い系統です。つっぱりや乾燥を感じたときは、おだやかな系統に替える選択肢があります。',
          }
        : {
            level: 'neutral',
            message: '洗浄力がおだやかな系統です。日常的に使いやすい傾向があります。',
          };
  }
}

function judgeScalp(base: KnownBase, scalp: Profile['scalp']): Verdict | null {
  if (!scalp) return null;

  const strong = STRENGTH[base] === 'strong';
  const soap = base === '石鹸系';

  switch (scalp) {
    case '乾燥':
    case 'ふけ・かゆみ':
      if (!strong)
        return {
          level: 'good',
          message: '洗浄力がおだやかな系統です。頭皮への負担を抑えたい場合に向いています。',
        };
      return {
        level: 'caution',
        message: soap
          ? `さっぱり洗えますがアルカリ性です。${scalp === '乾燥' ? '乾燥した頭皮' : 'ふけ・かゆみがある頭皮'}では刺激になる可能性があります。`
          : `洗浄力が強い系統です。${scalp === '乾燥' ? '乾燥した頭皮' : 'ふけ・かゆみがある頭皮'}では刺激になる可能性があります。`,
      };

    case '脂性':
      if (!strong)
        return {
          level: 'caution',
          message:
            '洗浄力がおだやかな系統です。皮脂が多い場合は洗い上がりが物足りない可能性があります。',
        };
      return {
        level: 'good',
        message: soap
          ? 'さっぱり洗える系統です。皮脂が多い頭皮には合いやすい傾向があります。'
          : '洗浄力が強い系統です。皮脂が多い頭皮には合いやすい傾向があります。',
      };

    case '普通':
      return strong
        ? {
            level: 'neutral',
            message:
              '洗浄力が強い系統です。乾燥やかゆみを感じたときは、おだやかな系統に替える選択肢があります。',
          }
        : {
            level: 'neutral',
            message: '洗浄力がおだやかな系統です。日常的に使いやすい傾向があります。',
          };
  }
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

  // 肌質・頭皮が未設定のときだけ、系統の一般的な説明にとどめる
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
