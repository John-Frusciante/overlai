import { matchesIngredient, sourceForIngredient } from './knowledge';
import type { ExtractionResult, Judgement, Reason, StockItem } from './types';

/**
 * 判定理由の裏取り — 「根拠なき警告を出さない」をサーバー側で強制する
 *
 * プロンプトで「必ず成分名を書く」と指示し、スキーマで `ingredient` を必須にしても、
 * **書かれた成分名が実在するとは限らない**。実測では、入力のどこにも無い成分名を挙げた
 * 理由が返ることがあった（docs/TESTING.md §H）。
 *
 * ここでやるのは2つ。
 *
 * 1. **辿れない理由を落とす。** 理由に書かれた成分名が、店頭商品の成分にも
 *    在庫の成分にも見当たらないなら、それは根拠として成立しない。
 * 2. **辿れた理由に出典を付ける。** 手持ちの表（lib/knowledge.ts）に載っている成分なら
 *    その添付文書名を、載っていなければ PMDA の検索の入り口を渡す。
 *
 * ⚠ できないことも書いておく。ここが確かめるのは「その成分が実在するか」までであり、
 * **書かれた作用機序が正しいかは確かめられない**。理由の文面そのものの正しさは
 * 依然としてモデルの知識に依存している。だから出典を添えて、人が確かめられるようにする。
 *
 * ⚠ シグナル（🔵🟡🔴）は書き換えない。理由が全部落ちても色は下げない。
 * 安全側の判断を、検証が通らなかったという理由で緩めないため。
 */

/** PMDA 医薬品検索。成分名で添付文書を引ける公的な入り口 */
const PMDA_SEARCH = 'https://www.pmda.go.jp/PmdaSearch/iyakuSearch/?keyword=';

/**
 * 理由に書かれた成分名を、入力に実在する成分名まで辿る。
 *
 * 表記ゆれと書き足しを吸収するため、区切り文字で分けたどの断片かが当たれば通す。
 * 「ステロイド（ベタメタゾン吉草酸エステル）」のように、一般名と成分名を
 * 併記してくることがあり、丸ごと突き合わせると取りこぼす。
 */
export function traceIngredient(written: string, known: string[]): string | null {
  const fragments = splitFragments(written);
  for (const fragment of fragments) {
    const found = known.find((k) => matchesIngredient(fragment, k));
    if (found) return found;
  }
  return null;
}

function splitFragments(s: string): string[] {
  return [s, ...s.split(/[、,／/・（）()「」]+/)]
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
}

export interface VerifyResult {
  judgement: Judgement;
  /** 根拠を辿れずに落とした理由。ログに残して、あとで傾向を見るために返す */
  dropped: Reason[];
}

/**
 * 理由を検証し、出典を付けて返す。
 *
 * 併せて、これまで route が持っていた2つの上書き（安全に関わる値をモデルに委ねない）も
 * ここに集約する。判定の後始末が1箇所にまとまっていないと、経路が増えたときに片方だけ漏れる。
 */
export function verifyJudgement(
  raw: Judgement,
  extraction: ExtractionResult,
  stock: StockItem[],
): VerifyResult {
  const known = [...extraction.ingredients, ...stock.flatMap((s) => s.ingredients)].filter(
    (x) => x.trim().length > 0,
  );

  const kept: Reason[] = [];
  const dropped: Reason[] = [];

  for (const reason of raw.reasons) {
    // 成分名のない理由は根拠として成立しない（従来からの制約）
    if (!reason.ingredient.trim()) {
      dropped.push(reason);
      continue;
    }
    const traced = traceIngredient(reason.ingredient, known);
    if (!traced) {
      dropped.push(reason);
      continue;
    }
    kept.push({ ...reason, evidence: evidenceFor(traced) });
  }

  return {
    judgement: {
      ...raw,
      // 安全に関わる値をモデル出力に委ねない（§7.4）
      consult_recommended: raw.signal === 'red' ? true : raw.consult_recommended,
      reasons: kept,
    },
    dropped,
  };
}

/**
 * 出典を引く。捏造を避けるため、返すのは次の2つだけ。
 *   - 手持ちの表に載っている成分 … その添付文書名と、PMDA の検索リンク
 *   - 載っていない成分         … PMDA の検索リンクだけ（文書名は名乗らない）
 */
function evidenceFor(ingredient: string): { label: string; url: string } {
  const url = PMDA_SEARCH + encodeURIComponent(ingredient);
  const source = sourceForIngredient(ingredient);
  return { label: source ?? `${ingredient}の添付文書を探す（PMDA）`, url };
}
