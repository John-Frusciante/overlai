import type { ConflictWarning, ItemForm, RoutineStep, StockItem } from './types';

/**
 * 洗う・塗る順序の自動ソート — 企画書 §4 ②
 *
 * AIを使わずルールベースで組む。剤形と基剤から順序が一意に決まるため、
 * 推論を挟む必要がなく、デモでも決定的に動く。
 */

/**
 * アウトバス（塗る順序）の重み。
 * 水分が多く浸透の速いものから、油分が多く「蓋」になるものへ並べる。
 * 処方外用薬も剤形で判断する（ローション基剤は化粧水寄り、軟膏は最後）。
 */
const OUTBATH_ORDER: Partial<Record<ItemForm, number>> = {
  導入液: 10,
  化粧水: 20,
  美容液: 30,
  ローション: 40,
  乳液: 50,
  クリーム: 60,
  軟膏: 70,
  オイル: 80,
};

/**
 * インバス（洗う順序）の重み。
 * トリートメントを流し切ってから体を洗う。
 * 髪に残った油分が背中に残ることを避けるための順序。
 */
const INBATH_ORDER: Partial<Record<ItemForm, number>> = {
  シャンプー: 10,
  トリートメント: 20,
  洗顔: 30,
  ボディソープ: 40,
};

const OUTBATH_NOTE: Partial<Record<ItemForm, string>> = {
  導入液: '後に使うものの入りをよくします',
  化粧水: '水分の多いものから順に入れていきます',
  美容液: '有効成分を届けます',
  ローション: '水分を保つ処方薬です。薬を塗る前の土台になります',
  乳液: '水分を逃さないよう油分でつなぎます',
  クリーム: '油分で覆って水分を閉じ込めます',
  軟膏: '油分が最も多いため最後に置きます。塗った上に他のものを重ねません',
  オイル: '最後に蓋をします',
};

const INBATH_NOTE: Partial<Record<ItemForm, string>> = {
  シャンプー: '髪と頭皮を先に洗います',
  トリートメント: '流し残しが体に付かないよう、この後で体を洗います',
  洗顔: '髪をすすいだ後に顔を洗います',
  ボディソープ: '最後に体を洗い、トリートメントの残りを流します',
};

export function buildRoutine(stock: StockItem[], kind: 'inbath' | 'outbath'): RoutineStep[] {
  const table = kind === 'inbath' ? INBATH_ORDER : OUTBATH_ORDER;
  const notes = kind === 'inbath' ? INBATH_NOTE : OUTBATH_NOTE;

  return stock
    .filter((i) => i.routine === kind && table[i.form] !== undefined)
    .sort((a, b) => (table[a.form] ?? 999) - (table[b.form] ?? 999))
    .map((item, idx) => ({
      order: idx + 1,
      item,
      note: notes[item.form] ?? '',
    }));
}

/**
 * 成分バッティング — 企画書 §4「成分バッティング警告」
 *
 * 同時使用で刺激になる可能性が指摘されている組み合わせのみを列挙する。
 * 断定はせず「〜の可能性があります」で統一する（設計仕様書 §12）。
 */
const CONFLICT_RULES: Array<{ a: string[]; b: string[]; detail: string }> = [
  {
    a: ['レチノール', 'レチノイン酸', 'パルミチン酸レチノール'],
    b: ['アスコルビン酸', 'ビタミンC', 'アスコルビルグルコシド'],
    detail:
      'レチノールと高濃度のビタミンCは、同じタイミングで重ねると刺激になる可能性があります。朝と夜で分けることが一般的です。',
  },
  {
    a: ['レチノール', 'レチノイン酸'],
    b: ['グリコール酸', 'サリチル酸', '乳酸'],
    detail:
      'レチノールとAHA／BHAを同時に使うと、角質への作用が重なって刺激になる可能性があります。',
  },
  {
    a: ['アスコルビン酸', 'ビタミンC'],
    b: ['グリコール酸', 'サリチル酸'],
    detail:
      'ビタミンCとAHA／BHAはどちらも酸性度が高く、重ねると刺激になる可能性があります。',
  },
];

const hit = (ingredients: string[], keys: string[]) =>
  keys.find((k) => ingredients.some((ing) => ing.includes(k)));

export function findConflicts(steps: RoutineStep[]): ConflictWarning[] {
  const out: ConflictWarning[] = [];
  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      const x = steps[i].item;
      const y = steps[j].item;
      for (const rule of CONFLICT_RULES) {
        const p = hit(x.ingredients, rule.a) && hit(y.ingredients, rule.b);
        const q = hit(x.ingredients, rule.b) && hit(y.ingredients, rule.a);
        if (p || q) {
          out.push({
            items: [x.name, y.name],
            ingredients: p
              ? [hit(x.ingredients, rule.a)!, hit(y.ingredients, rule.b)!]
              : [hit(x.ingredients, rule.b)!, hit(y.ingredients, rule.a)!],
            detail: rule.detail,
          });
        }
      }
    }
  }
  return out;
}
