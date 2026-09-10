import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  ABSORPTION_RULES,
  CONFLICT_RULES,
  INTERACTION_RULES,
  THERAPEUTIC_CLASSES,
  matchesIngredient,
  sourceForIngredient,
  therapeuticClassOf,
} from '../lib/knowledge';

/**
 * 知識ベースの検査 — 出典が付いていることと、代表的な組み合わせを引けること
 *
 * 中身の医学的な正しさは、ここでは確かめられない（それは出典を読む人の仕事）。
 * 確かめるのは「出典を書かずに項目を足していないか」「引けるはずのものが引けるか」。
 */
describe('薬の知識', () => {
  it('すべての項目に出典が付いている', () => {
    const all = [
      ...THERAPEUTIC_CLASSES,
      ...ABSORPTION_RULES,
      ...INTERACTION_RULES,
      ...CONFLICT_RULES,
    ];
    assert.ok(all.length > 0);
    for (const rule of all) {
      assert.ok(
        rule.source && rule.source.trim().length >= 8,
        `出典の無い項目があります: ${JSON.stringify(rule).slice(0, 60)}`,
      );
    }
  });

  it('表記ゆれを吸収して成分名を照合できる', () => {
    assert.ok(matchesIngredient('ワルファリンカリウム', 'ワルファリン'));
    assert.ok(matchesIngredient('イブプロフェン（200mg）', 'イブプロフェン'));
    assert.ok(matchesIngredient('ロキソプロフェン', 'ロキソプロフェンナトリウム水和物'));
    assert.ok(!matchesIngredient('グリセリン', 'イブプロフェン'));
    assert.ok(!matchesIngredient('', 'イブプロフェン'));
  });

  it('成分名の違う解熱鎮痛薬が同じ群に入る', () => {
    const a = therapeuticClassOf('アセトアミノフェン');
    const b = therapeuticClassOf('イブプロフェン');
    assert.equal(a?.name, '解熱鎮痛');
    assert.equal(b?.name, '解熱鎮痛');
  });

  it('知らない成分は群に入れない', () => {
    assert.equal(therapeuticClassOf('ヘパリン類似物質'), null);
  });

  it('相互作用の代表例に、抗凝固薬 × NSAIDs が入っている', () => {
    const rule = INTERACTION_RULES.find((r) =>
      r.stock.examples.some((e) => e.includes('ワルファリン')),
    );
    assert.ok(rule, '抗凝固薬の相互作用が登録されていません');
    assert.ok(rule!.otc.examples.some((e) => e.includes('イブプロフェン')));
  });

  it('吸収阻害に鉄 × テトラサイクリン系が入っている（デモの前提）', () => {
    const rule = ABSORPTION_RULES.find(
      (r) =>
        r.agent.examples.some((e) => e.includes('鉄')) &&
        r.affected.examples.some((e) => e.includes('ミノサイクリン')),
    );
    assert.ok(rule, 'シードの抗菌薬に対応する吸収阻害がありません');
  });

  it('表に載っている成分からは出典を引ける', () => {
    assert.ok(sourceForIngredient('ワルファリンカリウム'));
    assert.ok(sourceForIngredient('ミノサイクリン塩酸塩'));
    assert.ok(sourceForIngredient('イブプロフェン'));
  });

  it('表に無い成分の出典は作らない', () => {
    assert.equal(sourceForIngredient('ヘパリン類似物質'), null);
    assert.equal(sourceForIngredient('コカミドプロピルベタイン'), null);
  });
});
