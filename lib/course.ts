import type { Course, StockItem } from './types';

/**
 * 処方の終わる日 — Issue #35
 *
 * 残量は服薬のチェックを付けたときしか減らない。チェックを付け忘れる人には
 * 残量からは終わりが分からないので、袋に書いてある「何日分」から求める。
 *
 * 日付は `todayKey()`（lib/storage.ts）と同じ UTC の `YYYY-MM-DD` で扱う。
 * 服薬記録と同じ物差しにしておかないと、日付の境目で両者がずれる。
 *
 * ⚠ 終わる日が来ても在庫から**自動では外さない**。やめた後もしばらく併用に注意が要る
 * 薬があり、本当に飲み終わったかは本人にしか分からない。聞くだけにする。
 */

const MAX_DAYS = 365;

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, n: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 最後に飲む日。10/1から14日分なら10/14 */
export function lastDay(course: Course): string {
  return addDays(course.startedAt, course.days - 1);
}

/** 最後に飲む日の**翌日以降**か。当日はまだ飲むので聞かない */
export function courseEnded(item: Pick<StockItem, 'course'>, today: string): boolean {
  if (!item.course) return false;
  return today > lastDay(item.course);
}

export function endedCourses(stock: StockItem[], today: string): StockItem[] {
  return stock.filter((i) => courseEnded(i, today));
}

/** 「まだ飲んでいる」— 本人が答えた「あと何日分」で、今日から数え直す */
export function extendCourse(days: number, today: string): Course {
  return { startedAt: today, days };
}

/** 入力欄の「何日分」。整数でないもの・範囲外は受け付けない */
export function parseDays(input: string): number | null {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= MAX_DAYS ? n : null;
}

export function formatMonthDay(date: string): string {
  const d = toDate(date);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
