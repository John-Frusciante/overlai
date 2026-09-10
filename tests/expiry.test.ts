import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { alertFor, collectAlerts, lowStock } from '../lib/expiry';
import type { ItemForm, StockItem } from '../lib/types';

/** 使用期限・開封後の目安 — 今日を固定して確かめる */

const TODAY = new Date('2026-09-10T00:00:00Z');

function shift(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function item(form: ItemForm, extra: Partial<StockItem> = {}): StockItem {
  return {
    id: 'i-1',
    name: 'テスト',
    category: 'スキンケア',
    form,
    ingredients: [],
    status: '使用中',
    isPrescription: false,
    ...extra,
  };
}

describe('使用期限', () => {
  it('過ぎていれば expired', () => {
    const alert = alertFor(item('錠剤', { expiresAt: shift(-3) }), TODAY);
    assert.equal(alert?.level, 'expired');
    assert.equal(alert?.kind, '使用期限');
    assert.ok(alert!.message.includes('3日'));
  });

  it('30日以内なら soon', () => {
    assert.equal(alertFor(item('錠剤', { expiresAt: shift(10) }), TODAY)?.level, 'soon');
  });

  it('まだ先なら何も出さない', () => {
    assert.equal(alertFor(item('錠剤', { expiresAt: shift(200) }), TODAY), null);
  });
});

describe('開封後の目安', () => {
  it('剤形ごとの目安を過ぎたら知らせる', () => {
    // 美容液は3ヶ月
    const alert = alertFor(item('美容液', { openedAt: shift(-120) }), TODAY);
    assert.equal(alert?.kind, '開封後の目安');
    assert.equal(alert?.level, 'expired');
    assert.ok(alert!.message.includes('可能性があります'));
  });

  it('目安を持たない剤形には出さない', () => {
    assert.equal(alertFor(item('錠剤', { openedAt: shift(-800) }), TODAY), null);
  });

  it('使用期限があればそちらを優先する', () => {
    const alert = alertFor(
      item('美容液', { openedAt: shift(-120), expiresAt: shift(5) }),
      TODAY,
    );
    assert.equal(alert?.kind, '使用期限');
  });
});

describe('一覧', () => {
  it('期限が近いものから並ぶ', () => {
    const alerts = collectAlerts(
      [
        { ...item('錠剤', { expiresAt: shift(20) }), id: 'a' },
        { ...item('錠剤', { expiresAt: shift(-5) }), id: 'b' },
      ],
      TODAY,
    );
    assert.deepEqual(alerts.map((a) => a.itemId), ['b', 'a']);
  });

  it('残量が少ないものを拾う', () => {
    const low = lowStock([
      { ...item('錠剤', { remaining: { count: 3, unit: '錠' } }), id: 'a' },
      { ...item('錠剤', { remaining: { count: 30, unit: '錠' } }), id: 'b' },
      { ...item('錠剤'), id: 'c' },
    ]);
    assert.deepEqual(low.map((i) => i.id), ['a']);
  });
});
