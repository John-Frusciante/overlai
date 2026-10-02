import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  addDays,
  courseEnded,
  endedCourses,
  extendCourse,
  formatMonthDay,
  lastDay,
  parseDays,
} from '../lib/course';
import type { StockItem } from '../lib/types';

/** 処方の終わる日 — 「飲み終わりましたか」をいつ聞くか */

function item(extra: Partial<StockItem> = {}): StockItem {
  return {
    id: 'i-1',
    name: 'テスト錠',
    category: '処方薬',
    form: '錠剤',
    ingredients: [],
    status: '',
    isPrescription: true,
    ...extra,
  };
}

describe('終わる日', () => {
  it('10/1から14日分なら、最後に飲む日は10/14', () => {
    assert.equal(lastDay({ startedAt: '2026-10-01', days: 14 }), '2026-10-14');
  });

  it('月をまたいでも数えられる', () => {
    assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  });

  it('最後に飲む日の当日はまだ聞かない', () => {
    const i = item({ course: { startedAt: '2026-10-01', days: 14 } });
    assert.equal(courseEnded(i, '2026-10-14'), false);
  });

  it('最後に飲む日の翌日から聞く', () => {
    const i = item({ course: { startedAt: '2026-10-01', days: 14 } });
    assert.equal(courseEnded(i, '2026-10-15'), true);
    assert.equal(courseEnded(i, '2026-11-20'), true);
  });

  it('何日分が入っていない薬には聞かない', () => {
    assert.equal(courseEnded(item(), '2030-01-01'), false);
  });

  it('終わった薬だけを拾う', () => {
    const done = item({ id: 'a', course: { startedAt: '2026-10-01', days: 3 } });
    const going = item({ id: 'b', course: { startedAt: '2026-10-01', days: 30 } });
    const none = item({ id: 'c' });
    assert.deepEqual(
      endedCourses([done, going, none], '2026-10-10').map((i) => i.id),
      ['a'],
    );
  });
});

describe('まだ飲んでいるとき', () => {
  it('「あと5日分」は今日から5日分に置き換える', () => {
    const next = extendCourse(5, '2026-10-15');
    assert.deepEqual(next, { startedAt: '2026-10-15', days: 5 });
    assert.equal(lastDay(next), '2026-10-19');
    assert.equal(courseEnded(item({ course: next }), '2026-10-19'), false);
    assert.equal(courseEnded(item({ course: next }), '2026-10-20'), true);
  });
});

describe('何日分の入力', () => {
  it('1〜365 の整数だけを受け付ける', () => {
    assert.equal(parseDays('14'), 14);
    assert.equal(parseDays(' 7 '), 7);
    assert.equal(parseDays(''), null);
    assert.equal(parseDays('0'), null);
    assert.equal(parseDays('-3'), null);
    assert.equal(parseDays('2.5'), null);
    assert.equal(parseDays('366'), null);
    assert.equal(parseDays('abc'), null);
  });
});

describe('表示', () => {
  it('月日だけを出す', () => {
    assert.equal(formatMonthDay('2026-10-14'), '10月14日');
    assert.equal(formatMonthDay('2026-01-05'), '1月5日');
  });
});
