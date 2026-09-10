import { CONFLICT_RULES } from './knowledge';
import type {
  BuiltinRoutine,
  ConflictWarning,
  ItemForm,
  RoutineKind,
  RoutineStep,
  StockItem,
} from './types';

/**
 * 洗う・塗る順序の自動ソート — 企画書 §4 ②
 *
 * AIを使わずルールベースで組む。剤形と基剤から順序が一意に決まるため、
 * 推論を挟む必要がなく、デモでも決定的に動く。
 *
 * 区分は組み込みの2つ（お風呂で洗う／お風呂上がりに塗る）に加えて、
 * ユーザーが「朝のスキンケア」などを作れる。どの区分でも並べ方は同じで、
 * 剤形の重み順に並べたうえで、手で入れ替えた分（`routineOrder`）を優先する。
 */

/** 組み込みの区分。ユーザーが作った区分はこの後ろに並ぶ */
export const BUILTIN_ROUTINES: BuiltinRoutine[] = ['inbath', 'outbath'];

const BUILTIN_LABELS: Record<BuiltinRoutine, { title: string; short: string; caption: string }> = {
  inbath: {
    title: 'お風呂で洗う順番',
    short: 'お風呂で洗う',
    caption: 'トリートメントの流し残しが体に付かない順に並べています',
  },
  outbath: {
    title: 'お風呂上がりに塗る順番',
    short: 'お風呂上がりに塗る',
    caption: '水分の多いものから、油分で蓋をするものへ並べています',
  },
};

export function isBuiltinRoutine(kind: string): kind is BuiltinRoutine {
  return kind === 'inbath' || kind === 'outbath';
}

/** 画面とプロンプトに出す区分の名前。ユーザーが作った区分は名前がそのままキー */
export function routineTitle(kind: RoutineKind): string {
  return isBuiltinRoutine(kind) ? BUILTIN_LABELS[kind].title : kind;
}

/** 選択肢に並べるときの短い名前。見出しの「〜順番」を落とした形 */
export function routineChipLabel(kind: RoutineKind): string {
  return isBuiltinRoutine(kind) ? BUILTIN_LABELS[kind].short : kind;
}

export function routineCaption(kind: RoutineKind): string {
  return isBuiltinRoutine(kind)
    ? BUILTIN_LABELS[kind].caption
    : '剤形の順に並べています。並べ替えると自分の使い方に合わせられます';
}

/**
 * 剤形の重み。小さいほど先に来る。
 *
 * 洗うもの（髪 → 顔 → 体）を先に置き、そのあとに塗るものを
 * 水分の多いものから油分で蓋をするものへと並べる。処方外用薬も剤形で判断する
 * （ローション基剤は化粧水寄り、軟膏は最後）。
 *
 * 区分ごとに別の表を持たないのは、ユーザーが作る区分（「朝のスキンケア」など）に
 * 洗顔と化粧水が同居しうるため。1本の物差しなら、どんな組み合わせでも並べられる。
 */
const ORDER: Partial<Record<ItemForm, number>> = {
  シャンプー: 10,
  トリートメント: 20,
  洗顔: 30,
  ボディソープ: 40,
  導入液: 50,
  化粧水: 60,
  美容液: 70,
  ローション: 80,
  乳液: 90,
  クリーム: 100,
  軟膏: 110,
  オイル: 120,
};

/** なぜこの位置なのかの説明。剤形から引く */
const NOTES: Partial<Record<ItemForm, string>> = {
  シャンプー: '髪と頭皮を先に洗います',
  トリートメント: '流し残しが体に付かないよう、この後で体を洗います',
  洗顔: '髪をすすいだ後に顔を洗います',
  ボディソープ: '最後に体を洗い、トリートメントの残りを流します',
  導入液: '後に使うものの入りをよくします',
  化粧水: '水分の多いものから順に入れていきます',
  美容液: '有効成分を届けます',
  ローション: '水分を保つ処方薬です。薬を塗る前の土台になります',
  乳液: '水分を逃さないよう油分でつなぎます',
  クリーム: '油分で覆って水分を閉じ込めます',
  軟膏: '油分が最も多いため最後に置きます。塗った上に他のものを重ねません',
  オイル: '最後に蓋をします',
};

/**
 * 並べ替えのキー。
 *
 * ユーザーが手で動かしたものが先に来て、まだ動かしていないものは
 * 剤形の重み順で後ろに続く。あとから追加したアイテムが、手で決めた並びの
 * 途中に割り込まないようにするための構造。
 */
function sortKey(item: StockItem): number {
  return item.routineOrder ?? 1000 + (ORDER[item.form] ?? 999);
}

export function buildRoutine(stock: StockItem[], kind: RoutineKind): RoutineStep[] {
  return stock
    .filter((i) => i.routine === kind)
    .sort((a, b) => sortKey(a) - sortKey(b))
    .map((item, idx) => ({
      order: idx + 1,
      item,
      note: NOTES[item.form] ?? '',
      // 剤形どおりでない位置に動かされていれば、説明は「一般的な目安」に留める
      reordered: item.routineOrder !== undefined,
    }));
}

/** その区分に手で決めた並びがあるか */
export function isReordered(steps: RoutineStep[]): boolean {
  return steps.some((s) => s.reordered);
}

// ── 区分の管理（カテゴリと同じ流儀） ───────────────────────────────────

export const MAX_ROUTINE_LENGTH = 12;

/**
 * 追加してよい名前かを調べる。
 * 弾く理由をそのまま画面に出せるよう、文字列で返す。
 */
export function validateRoutineName(
  raw: string,
  existing: string[],
): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.replace(/[\s　]+/g, ' ').trim();
  if (!name) return { ok: false, reason: '名前を入力してください' };
  if ([...name].length > MAX_ROUTINE_LENGTH) {
    return { ok: false, reason: `${MAX_ROUTINE_LENGTH}文字までにしてください` };
  }
  // 内部キーと衝突する名前は作らせない
  if (isBuiltinRoutine(name)) return { ok: false, reason: 'この名前は使えません' };
  if (BUILTIN_ROUTINES.some((k) => BUILTIN_LABELS[k].title === name)) {
    return { ok: false, reason: 'もとからあるルーティンです' };
  }
  if (existing.some((e) => e === name)) return { ok: false, reason: 'すでにあります' };
  return { ok: true, name };
}

/**
 * 画面に並べる区分を決める。
 *
 * 組み込み → ユーザーが追加したもの → **在庫にしか存在しない名前** の順。
 * 3つ目を入れているのは、区分を消しても中身が画面から消えないようにするため。
 */
export function orderedRoutines(custom: string[], items: StockItem[]): RoutineKind[] {
  const out: RoutineKind[] = [...BUILTIN_ROUTINES];
  for (const c of custom) if (!out.includes(c)) out.push(c);
  for (const i of items) if (i.routine && !out.includes(i.routine)) out.push(i.routine);
  return out;
}

/** その区分を使っている在庫の件数 */
export function countInRoutine(items: StockItem[], kind: RoutineKind): number {
  return items.filter((i) => i.routine === kind).length;
}

/**
 * 成分バッティング — 企画書 §4「成分バッティング警告」
 *
 * 組み合わせそのものは lib/knowledge.ts が出典つきで持つ。
 * ここが持つのは「並んだステップの総当たりで引き当てる」という手順だけ。
 */
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
