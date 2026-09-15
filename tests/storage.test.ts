import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  STORAGE_KEYS,
  addStock,
  loadStock,
  resetAll,
  saveCollapsed,
  saveCustomCategories,
  saveCustomRoutines,
  saveProfile,
  saveRoutineAdvice,
  toggleDose,
} from '../lib/storage';
import { SEED_STOCK } from '../lib/seed';

/**
 * 初期化の漏れを見張る — ブース展示の「見本に戻す」（#25）
 *
 * localStorage は Node に無いので、Map で作った偽物を window に生やす。
 * lib/storage.ts は `typeof window` で環境を見ているため、これだけで本物と同じ経路を通る。
 */

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

let storage = fakeStorage();

beforeEach(() => {
  storage = fakeStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
});

describe('resetAll', () => {
  it('在庫・服薬記録・肌質・開閉・カテゴリ・区分・解説キャッシュをすべて見本に戻す', () => {
    addStock({ ...SEED_STOCK[0], name: '来場者が足した商品' });
    toggleDose(SEED_STOCK[1], '朝');
    saveProfile({ skin: '乾燥', note: '来場者の申告' });
    saveCollapsed(['スキンケア']);
    saveCustomCategories(['出先用']);
    saveCustomRoutines(['朝のスキンケア']);
    saveRoutineAdvice('sig', { overall: 'x', steps: [] });
    assert.equal(loadStock().length, SEED_STOCK.length + 1);

    const result = resetAll();

    assert.deepEqual(result, SEED_STOCK);
    assert.deepEqual(loadStock(), SEED_STOCK);
    for (const key of STORAGE_KEYS()) {
      const raw = storage.getItem(key);
      const value = raw === null ? null : JSON.parse(raw);
      if (key.includes('stock')) assert.deepEqual(value, SEED_STOCK, key);
      else if (key.includes('profile')) assert.deepEqual(value, {}, key);
      else if (key.includes('advice')) assert.equal(value, null, key);
      else assert.deepEqual(value, [], key);
    }
  });

  it('このファイルが書く鍵は STORAGE_KEYS にすべて載っている（載っていない鍵は初期化から漏れる）', () => {
    addStock({ ...SEED_STOCK[0], name: 'x' });
    toggleDose(SEED_STOCK[1], '朝');
    saveProfile({ skin: '乾燥' });
    saveCollapsed(['a']);
    saveCustomCategories(['b']);
    saveCustomRoutines(['c']);
    saveRoutineAdvice('sig', { overall: 'x', steps: [] });
    const known = new Set(STORAGE_KEYS());
    for (const key of storage.keys()) {
      assert.ok(known.has(key), `未登録の鍵: ${key}`);
    }
  });
});
