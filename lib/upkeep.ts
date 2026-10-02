import { endedCourses } from './course';
import { collectAlerts, lowStock } from './expiry';
import type { ExpiryAlert, StockItem } from './types';

/**
 * マイストックのアラート欄 — 処方の終わり・期限・残量（Issue #35）
 *
 * 「飲み終わりましたか」に出ている薬は、期限や残量の行に重ねて出さない。
 * どれも「在庫を見直して」という同じ用件なので、同じ品について聞くのは1回でよい。
 */
export function upkeepAlerts(
  stock: StockItem[],
  today: string,
  now = new Date(),
): { ended: StockItem[]; expiry: ExpiryAlert[]; low: StockItem[] } {
  const ended = endedCourses(stock, today);
  const asked = new Set(ended.map((i) => i.id));
  return {
    ended,
    expiry: collectAlerts(stock, now).filter((a) => !asked.has(a.itemId)),
    low: lowStock(stock).filter((i) => !asked.has(i.id)),
  };
}
