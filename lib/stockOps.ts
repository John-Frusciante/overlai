import type { ItemForm, RoutineKind, StockCategory, StockItem } from './types';

/**
 * 買い替えたときの入れ替え — Issue #35
 *
 * 店頭でスキャンした商品を「買ったので在庫に入れる」とき、同じ剤形の古いものと
 * 入れ替えられるようにする。同じ化粧水が2本並んだまま残ると、使い切ったものとの
 * 照合で警告が出続けるため。
 *
 * lib/storage.ts から呼ばれるので、こちらから storage を import しないこと（循環になる）。
 */

/**
 * 入れ替えの候補。**同じ剤形で、処方薬でないもの。**
 *
 * 「その他」は何でも当たってしまうので候補を出さない。
 * 処方薬は店頭の商品で置き換えるものではないので除く（同じ「錠剤」でも）。
 */
export function replacementCandidates(stock: StockItem[], form: ItemForm): StockItem[] {
  if (form === 'その他') return [];
  return stock.filter((i) => i.form === form && !i.isPrescription);
}

/** 入れ替え先を選んだとき、入力欄に引き継ぐもの。ユーザーはここから変えられる */
export function inheritFrom(old: StockItem): { category: StockCategory; routine?: RoutineKind } {
  return { category: old.category, routine: old.routine };
}

/**
 * 古いものと入れ替えた新しいアイテムを作る。
 *
 * 並び順（`routineOrder`）は**同じ区分のときだけ**引き継ぐ。区分を変えたのに
 * 引き継ぐと、移った先の手動の並びに割り込む。
 * 開封日は引き継がない（新しい品は未開封）。
 */
export function replaceWith(old: StockItem, next: Omit<StockItem, 'id'>, id: string): StockItem {
  const sameRoutine = next.routine !== undefined && next.routine === old.routine;
  return {
    ...next,
    id,
    routineOrder: sameRoutine ? old.routineOrder : undefined,
  };
}
