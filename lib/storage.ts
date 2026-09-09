import type { DoseLog, DoseTime, Profile, StockItem } from './types';
import { SEED_STOCK } from './seed';

/**
 * 永続化層 — 設計仕様書 §10.1
 *
 * localStorage へのアクセスはこのファイルに閉じ込める。
 * 将来ネイティブ化する際は、このファイルだけを AsyncStorage 等に差し替える。
 * コンポーネントから localStorage を直接呼ばないこと。
 */

const STOCK_KEY = 'overlai.stock.v3';
const DOSE_KEY = 'overlai.dose.v1';
const PROFILE_KEY = 'overlai.profile.v1';
const COLLAPSED_KEY = 'overlai.collapsed.v1';
const CATEGORY_KEY = 'overlai.categories.v1';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // プライベートモード等で読めなくても動作を継続する
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できなくても致命的ではない */
  }
}

// ── 在庫 ────────────────────────────────────────────────────────────

export function loadStock(): StockItem[] {
  const items = read<StockItem[]>(STOCK_KEY, []);
  if (!Array.isArray(items) || items.length === 0) {
    write(STOCK_KEY, SEED_STOCK);
    return SEED_STOCK;
  }
  return items;
}

export function saveStock(items: StockItem[]): void {
  write(STOCK_KEY, items);
}

export function addStock(item: Omit<StockItem, 'id'>): StockItem[] {
  const items = loadStock();
  const next = [...items, { ...item, id: `stk-${Date.now().toString(36)}` }];
  saveStock(next);
  return next;
}

export function updateStock(id: string, patch: Partial<StockItem>): StockItem[] {
  const next = loadStock().map((i) => (i.id === id ? { ...i, ...patch } : i));
  saveStock(next);
  return next;
}

export function removeStock(id: string): StockItem[] {
  const next = loadStock().filter((i) => i.id !== id);
  saveStock(next);
  return next;
}

export function resetStock(): StockItem[] {
  saveStock(SEED_STOCK);
  write(DOSE_KEY, []);
  write(PROFILE_KEY, {});
  write(COLLAPSED_KEY, []);
  write(CATEGORY_KEY, []);
  return SEED_STOCK;
}

// ── ユーザーが追加したカテゴリ ───────────────────────

/**
 * 組み込みの6区分に加えて、ユーザーが自分で作ったカテゴリ名。
 * 「出先用」「常備薬」のように、その人の暮らしに合わせた区切りを持てるようにする。
 */
export function loadCustomCategories(): string[] {
  const v = read<string[]>(CATEGORY_KEY, []);
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export function saveCustomCategories(names: string[]): void {
  write(CATEGORY_KEY, names);
}

// ── 一覧の折りたたみ状態 ─────────────────────────────────────────────

/**
 * 閉じているカテゴリ名。件数が増えると一覧が長くなるため、
 * 開閉状態を画面遷移をまたいで保つ（撮影中にスキャンから戻っても崩れない）。
 */
export function loadCollapsed(): string[] {
  const v = read<string[]>(COLLAPSED_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function saveCollapsed(categories: string[]): void {
  write(COLLAPSED_KEY, categories);
}

// ── 肌質プロフィール ─────────────────────────────────────────────────

/** 肌質・頭皮状態。未設定なら空オブジェクトを返す（設定は任意） */
export function loadProfile(): Profile {
  return read<Profile>(PROFILE_KEY, {});
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, profile);
}

// ── 服薬記録 ─────────────────────────────────────────────────────────

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function loadDoseLog(date = todayKey()): DoseLog {
  const logs = read<DoseLog[]>(DOSE_KEY, []);
  return logs.find((l) => l.date === date) ?? { date, taken: [] };
}

/** 直近 n 日分の服薬記録を、古い日付から順に返す */
export function loadRecentDoseLogs(n = 7): DoseLog[] {
  const logs = read<DoseLog[]>(DOSE_KEY, []);
  const out: DoseLog[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayKey(d);
    out.push(logs.find((l) => l.date === date) ?? { date, taken: [] });
  }
  return out;
}

function saveDoseLog(log: DoseLog): void {
  const logs = read<DoseLog[]>(DOSE_KEY, []).filter((l) => l.date !== log.date);
  write(DOSE_KEY, [...logs, log].slice(-30)); // 直近30日分だけ保持する
}

export const doseKey = (itemId: string, time: DoseTime) => `${itemId}:${time}`;

/**
 * 服薬を記録／取り消しする。残薬も同時に増減させる。
 * 記録と残量が別々に管理されるとズレるため、ここで一括して扱う。
 */
export function toggleDose(
  item: StockItem,
  time: DoseTime,
  date = todayKey(),
): { log: DoseLog; stock: StockItem[] } {
  const log = loadDoseLog(date);
  const key = doseKey(item.id, time);
  const taken = log.taken.includes(key);

  const nextLog: DoseLog = {
    date,
    taken: taken ? log.taken.filter((k) => k !== key) : [...log.taken, key],
  };
  saveDoseLog(nextLog);

  let stock = loadStock();
  if (item.remaining && item.dose) {
    const delta = taken ? item.dose.perTime : -item.dose.perTime;
    const count = Math.max(0, item.remaining.count + delta);
    stock = updateStock(item.id, {
      remaining: { ...item.remaining, count },
      status: `残${count}${item.remaining.unit}`,
    });
  }

  return { log: nextLog, stock };
}
