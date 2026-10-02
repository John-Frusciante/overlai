import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  STORAGE_KEYS,
  addStock,
  clearPendingScan,
  exportBackup,
  importBackup,
  insertStock,
  loadPendingScan,
  loadStock,
  removeStock,
  replaceStock,
  resetAll,
  savePendingScan,
  updateStock,
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

let session = fakeStorage();

beforeEach(() => {
  storage = fakeStorage();
  session = fakeStorage();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    sessionStorage: session,
  };
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

describe('入れ替え', () => {
  it('古いものの位置に新しいものを入れ、区分と並び順を引き継ぐ', () => {
    const before = loadStock();
    const target = before[3];
    updateStock(target.id, { routine: 'outbath', routineOrder: 1 }); // まず区分を持たせる
    const result = replaceStock(target.id, {
      name: '新しい化粧水',
      category: 'スキンケア',
      form: target.form,
      ingredients: ['グリセリン'],
      status: '使用中',
      isPrescription: false,
      routine: 'outbath',
    });
    assert.equal(result.length, before.length);
    assert.equal(result[3].name, '新しい化粧水');
    assert.notEqual(result[3].id, target.id);
    assert.equal(result[3].routineOrder, 1);
    assert.ok(!result.some((i) => i.id === target.id));
  });

  it('古いものが見つからなければ普通に足す', () => {
    const before = loadStock().length;
    const result = replaceStock('no-such-id', { ...SEED_STOCK[0], name: '追加' });
    assert.equal(result.length, before + 1);
  });
});

describe('元に戻す', () => {
  it('外したものを元の位置に戻す', () => {
    const before = loadStock();
    removeStock(before[2].id);
    const result = insertStock(before[2], 2);
    assert.deepEqual(result, before);
  });
});

describe('スキャン結果の受け渡し', () => {
  const extraction = {
    product_name: '新しい化粧水',
    category: 'スキンケア' as const,
    form: '化粧水' as const,
    ingredients: ['グリセリン'],
    confidence: 'high' as const,
  };

  it('置いたものを読める。消すと読めない', () => {
    savePendingScan(extraction);
    assert.deepEqual(loadPendingScan(), extraction);
    clearPendingScan();
    assert.equal(loadPendingScan(), null);
  });

  it('localStorage には置かない（タブを閉じたら消える）', () => {
    savePendingScan(extraction);
    assert.ok(!storage.keys().some((k) => k.includes('pending')));
  });
});

describe('書き出しと読み込み', () => {
  it('処方の飲む期間が往復する', () => {
    const before = loadStock();
    updateStock(before[0].id, { course: { startedAt: '2026-10-01', days: 14 } });
    const text = JSON.stringify(exportBackup());
    resetAll();
    const result = importBackup(text);
    assert.ok(result.ok);
    assert.deepEqual(loadStock()[0].course, { startedAt: '2026-10-01', days: 14 });
  });
});
