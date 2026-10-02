import type { Course, StockItem } from './types';

/**
 * 処方の終わる日 — Issue #35
 *
 * 残量は服薬のチェックを付けたときしか減らない。チェックを付け忘れる人には
 * 残量からは終わりが分からないので、袋に書いてある「何日分」から求める。
 *
 * 「今日」は**端末の暦**で数える（`localDateKey()`）。利用者が入力して読むのは手元の日付であり、
 * UTC で数えると日本の朝9時前は前日になる。すると最後に飲む日の朝に「飲み終わりましたか」が出て、
 * まだ飲んでいる薬が在庫から外れ、照合から漏れる。
 * 日付どうしの足し引きは `YYYY-MM-DD` の文字列のまま行う（ここではタイムゾーンは関係しない）。
 *
 * ⚠ 終わる日が来ても在庫から**自動では外さない**。やめた後もしばらく併用に注意が要る
 * 薬があり、本当に飲み終わったかは本人にしか分からない。聞くだけにする。
 */

const MAX_DAYS = 365;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 端末の暦での今日（`YYYY-MM-DD`） */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 飲む期間として読める形か。書き出したファイルを手で直されると壊れた値が入りうる。
 * 壊れた日付を `Date` に通すと例外になり、マイストックの画面ごと落ちる。
 */
export function isCourse(v: unknown): v is Course {
  if (!v || typeof v !== 'object') return false;
  const c = v as Partial<Course>;
  return (
    typeof c.startedAt === 'string' &&
    DATE_RE.test(c.startedAt) &&
    !Number.isNaN(new Date(`${c.startedAt}T00:00:00Z`).getTime()) &&
    typeof c.days === 'number' &&
    Number.isInteger(c.days) &&
    c.days >= 1 &&
    c.days <= MAX_DAYS
  );
}

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
  if (!isCourse(item.course)) return false;
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
