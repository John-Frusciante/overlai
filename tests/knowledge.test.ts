import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  ABSORPTION_RULES,
  CONFLICT_RULES,
  INTERACTION_RULES,
  THERAPEUTIC_CLASSES,
  findAbsorptionRule,
  findInteractionRule,
  matchesIngredient,
  sharedTherapeuticClass,
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

  it('規則は店頭と在庫の両側が当てはまるときだけ引ける', () => {
    // 抗凝固薬が在庫にあるときだけ「抗凝固薬 × NSAIDs」になる
    assert.ok(findInteractionRule('イブプロフェン', ['イブプロフェン'], ['ワルファリンカリウム']));
    // イブプロフェンが規則に載っていても、相手がワルファリンでなければ名乗らない（Issue #42）
    assert.equal(findInteractionRule('イブプロフェン', ['イブプロフェン'], ['イブプロフェン']), null);
    assert.equal(
      findInteractionRule('イブプロフェン', ['イブプロフェン'], ['ミノサイクリン塩酸塩']),
      null,
    );
  });

  it('吸収阻害は妨げる側がどちらにあっても引ける', () => {
    assert.ok(findAbsorptionRule('鉄', ['クエン酸第一鉄ナトリウム'], ['ミノサイクリン塩酸塩']));
    assert.ok(findAbsorptionRule('ミノサイクリン', ['ミノサイクリン塩酸塩'], ['ヘム鉄']));
    // 金属を含まない鎮痛薬と抗菌薬の組は表に無い（Issue #43）
    assert.equal(
      findAbsorptionRule('ミノサイクリン', ['イブプロフェン', 'アリルイソプロピルアセチル尿素'], ['ミノサイクリン塩酸塩']),
      null,
    );
  });

  it('規則に当てはまっても、理由の成分がその規則に無ければ名乗らない', () => {
    assert.equal(
      findAbsorptionRule('無水カフェイン', ['乾燥水酸化アルミニウムゲル', '無水カフェイン'], ['ミノサイクリン塩酸塩']),
      null,
    );
  });

  it('同効薬の群は両側に入っているときだけ引ける', () => {
    assert.equal(
      sharedTherapeuticClass('アセトアミノフェン', ['アセトアミノフェン'], ['イブプロフェン'])?.name,
      '解熱鎮痛',
    );
    assert.equal(sharedTherapeuticClass('アセトアミノフェン', ['アセトアミノフェン'], ['ヘパリン類似物質']), null);
  });
});
