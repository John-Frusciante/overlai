import type { StockItem } from './types';

/**
 * 判定カードの「もう家に無い」→「元に戻す」— Issue #35
 *
 * 戻すときは、外す前の判定だけでなく**その判定が古かったかどうか**も一緒に戻す。
 * やり直しに失敗して灰色になった判定のまま次を外し、元に戻したときに灰色が消えると、
 * 外したはずの薬の警告が色付きで戻ってしまう。
 */

export interface Removal<R> {
  item: StockItem;
  index: number;
  before: R;
  staleBefore: string | null;
}

export function snapshotRemoval<R>(
  item: StockItem,
  index: number,
  result: R,
  stale: string | null,
): Removal<R> {
  return { item, index, before: result, staleBefore: stale };
}

export function restoreRemoval<R>(removal: Removal<R>): { result: R; stale: string | null } {
  return { result: removal.before, stale: removal.staleBefore };
}
