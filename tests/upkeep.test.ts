import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { upkeepAlerts } from '../lib/upkeep';
import type { StockItem } from '../lib/types';

/**
 * マイストックのアラート欄 — 同じ品を2行出さない
 *
 * 「飲み終わりましたか」に出ている薬は、期限や残量の行に重ねて出さない。
 * どちらも「在庫を見直して」という同じ用件なので、聞くのは1回でよい。
 */

const TODAY = '2026-10-20';
const NOW = new Date('2026-10-20T03:00:00Z');

function item(id: string, extra: Partial<StockItem> = {}): StockItem {
  return {
    id,
    name: id,
    category: '処方薬',
    form: '錠剤',
    ingredients: [],
    status: '',
    isPrescription: true,
    ...extra,
  };
}

describe('アラート欄', () => {
  const ended = item('ended', {
    course: { startedAt: '2026-10-01', days: 7 },
    expiresAt: '2026-10-25',
    remaining: { count: 2, unit: '錠' },
  });
  const expiring = item('expiring', { expiresAt: '2026-10-25' });
  const low = item('low', { remaining: { count: 2, unit: '錠' } });

  it('飲み終わりを聞いている薬は、期限と残量の行に出さない', () => {
    const result = upkeepAlerts([ended, expiring, low], TODAY, NOW);
    assert.deepEqual(result.ended.map((i) => i.id), ['ended']);
    assert.deepEqual(result.expiry.map((a) => a.itemId), ['expiring']);
    assert.deepEqual(result.low.map((i) => i.id), ['low']);
  });

  it('飲み終わりを聞いていなければ、今までどおり期限と残量に出す', () => {
    const going = { ...ended, course: { startedAt: '2026-10-15', days: 30 } };
    const result = upkeepAlerts([going], TODAY, NOW);
    assert.deepEqual(result.ended, []);
    assert.deepEqual(result.expiry.map((a) => a.itemId), ['ended']);
    assert.deepEqual(result.low.map((i) => i.id), ['ended']);
  });
});
