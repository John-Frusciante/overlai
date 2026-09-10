import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildRoutine,
  countInRoutine,
  findConflicts,
  isReordered,
  orderedRoutines,
  routineTitle,
  validateRoutineName,
} from '../lib/routine';
import type { ItemForm, RoutineKind, StockItem } from '../lib/types';

/** 洗う・塗る順序 — 順序はルールが決める（AIに委ねない）という前提の検査 */

let seq = 0;
function item(form: ItemForm, routine: RoutineKind, extra: Partial<StockItem> = {}): StockItem {
  seq += 1;
  return {
    id: `i-${seq}`,
    name: `${form}-${seq}`,
    category: 'スキンケア',
    form,
    ingredients: [],
    status: '使用中',
    isPrescription: false,
    routine,
    ...extra,
  };
}

describe('ルーティンの並び', () => {
  it('剤形の重み順に並ぶ（水分の多いものから油分で蓋をするものへ）', () => {
    const stock = [
      item('クリーム', 'outbath'),
      item('化粧水', 'outbath'),
      item('美容液', 'outbath'),
    ];
    const forms = buildRoutine(stock, 'outbath').map((s) => s.item.form);
    assert.deepEqual(forms, ['化粧水', '美容液', 'クリーム']);
  });

  it('洗う順はシャンプー → トリートメント → 洗顔 → ボディソープ', () => {
    const stock = [
      item('ボディソープ', 'inbath'),
      item('洗顔', 'inbath'),
      item('シャンプー', 'inbath'),
      item('トリートメント', 'inbath'),
    ];
    const forms = buildRoutine(stock, 'inbath').map((s) => s.item.form);
    assert.deepEqual(forms, ['シャンプー', 'トリートメント', '洗顔', 'ボディソープ']);
  });

  it('手で決めた並びが剤形より優先される', () => {
    const cream = item('クリーム', 'outbath', { routineOrder: 0 });
    const lotion = item('化粧水', 'outbath', { routineOrder: 1 });
    const steps = buildRoutine([lotion, cream], 'outbath');
    assert.deepEqual(steps.map((s) => s.item.form), ['クリーム', '化粧水']);
    assert.ok(isReordered(steps));
  });

  it('まだ動かしていないものは、手で決めた並びの後ろに付く', () => {
    const moved = item('クリーム', 'outbath', { routineOrder: 0 });
    const added = item('化粧水', 'outbath');
    const steps = buildRoutine([added, moved], 'outbath');
    assert.deepEqual(steps.map((s) => s.item.form), ['クリーム', '化粧水']);
  });

  it('重みを持たない剤形も落とさずに並べる', () => {
    const steps = buildRoutine([item('その他', '朝のスキンケア')], '朝のスキンケア');
    assert.equal(steps.length, 1);
  });

  it('区分が違うものは混ざらない', () => {
    const stock = [item('化粧水', 'outbath'), item('シャンプー', 'inbath')];
    assert.equal(buildRoutine(stock, 'outbath').length, 1);
    assert.equal(countInRoutine(stock, 'inbath'), 1);
  });
});

describe('区分の管理', () => {
  it('組み込みの区分は表示名に置き換わる', () => {
    assert.equal(routineTitle('inbath'), 'お風呂で洗う順番');
    assert.equal(routineTitle('朝のスキンケア'), '朝のスキンケア');
  });

  it('内部キーと同じ名前は作らせない', () => {
    assert.equal(validateRoutineName('inbath', []).ok, false);
    assert.equal(validateRoutineName('お風呂で洗う順番', []).ok, false);
  });

  it('空・長すぎ・重複を弾く', () => {
    assert.equal(validateRoutineName('   ', []).ok, false);
    assert.equal(validateRoutineName('あ'.repeat(13), []).ok, false);
    assert.equal(validateRoutineName('朝', ['朝']).ok, false);
  });

  it('前後の空白を落として受け入れる', () => {
    const result = validateRoutineName('  朝の スキンケア  ', []);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.name, '朝の スキンケア');
  });

  it('区分を消しても、在庫に残っている名前は画面から消えない', () => {
    const kinds = orderedRoutines([], [item('化粧水', '寝る前')]);
    assert.ok(kinds.includes('寝る前'));
  });
});

describe('成分バッティング', () => {
  it('レチノールとビタミンCの重ねづけを拾う', () => {
    const a = item('美容液', 'outbath', { ingredients: ['レチノール'] });
    const b = item('化粧水', 'outbath', { ingredients: ['アスコルビン酸'] });
    const found = findConflicts(buildRoutine([a, b], 'outbath'));
    assert.equal(found.length, 1);
    assert.ok(found[0].detail.includes('可能性があります'));
  });

  it('関係のない組み合わせでは何も出さない', () => {
    const a = item('美容液', 'outbath', { ingredients: ['ナイアシンアミド'] });
    const b = item('化粧水', 'outbath', { ingredients: ['グリセリン'] });
    assert.equal(findConflicts(buildRoutine([a, b], 'outbath')).length, 0);
  });
});
