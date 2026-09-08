import type { StockItem } from './types';
import { SEED_STOCK } from './seed';

/**
 * 永続化層 — 設計仕様書 §10.1
 *
 * localStorage へのアクセスはこのファイルに閉じ込める。
 * 将来ネイティブ化する際は、このファイルだけを AsyncStorage 等に差し替える。
 * コンポーネントから localStorage を直接呼ばないこと。
 */

const KEY = 'overlai.stock.v1';

export function loadStock(): StockItem[] {
  if (typeof window === 'undefined') return SEED_STOCK;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      saveStock(SEED_STOCK);
      return SEED_STOCK;
    }
    const parsed = JSON.parse(raw) as StockItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_STOCK;
  } catch {
    // プライベートモード等で読み書きが失敗しても、シードで動作を継続する
    return SEED_STOCK;
  }
}

export function saveStock(items: StockItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* 保存できなくても致命的ではない */
  }
}

export function resetStock(): StockItem[] {
  saveStock(SEED_STOCK);
  return SEED_STOCK;
}
