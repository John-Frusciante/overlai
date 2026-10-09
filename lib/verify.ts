import {
  IRRITANT_INGREDIENTS,
  findAbsorptionRule,
  findInteractionRule,
  matchesIngredient,
  sharedTherapeuticClass,
  tableRisksBetween,
} from './knowledge';
import type { ExtractionResult, Judgement, Reason, Signal, StockItem } from './types';

/**
 * 判定理由の裏取り — 「根拠なき警告を出さない」をサーバー側で強制する
 *
 * プロンプトで「必ず成分名を書く」と指示し、スキーマで `ingredient` を必須にしても、
 * **書かれた成分名が実在するとは限らない**。実測では、入力のどこにも無い成分名を挙げた
 * 理由が返ることがあった（docs/TESTING.md §H）。
 *
 * ここでやるのは3つ。
 *
 * 1. **辿れない理由を落とす。** 理由に書かれた成分名が、店頭商品の成分にも
 *    在庫の成分にも見当たらないなら、それは根拠として成立しない。
 * 2. **組み合わせが成り立たない理由を落とす。** 成分が実在しても、相手の在庫
 *    （`related_item`）と組み合わせて理由の種類が成り立つとは限らない（Issue #43）。
 *    - 成分重複 … その成分が店頭商品と相手の在庫の**両方**に入っていること
 *    - 吸収阻害・相互作用 … 店頭商品と相手の在庫の組が、手持ちの表（lib/knowledge.ts）に
 *      載っていること。プロンプトで「表に無い組み合わせを作るな」と縛っても守られないことがある
 *    - 刺激リスク … 店頭商品に入っている成分で、刺激成分の表（IRRITANT_INGREDIENTS）に
 *      載っていること。外用薬の側の成分（ベタメタゾンなど）や保湿剤を挙げた理由は落とす
 *    - 効能重複 … 表は網羅ではないので、成分が辿れれば残す
 * 3. **残った理由に出典を付ける。** 規則の出典を名乗るのは、その組み合わせが規則に
 *    当てはまるときだけ（Issue #42）。当てはまらなければ PMDA の検索の入り口だけを渡す。
 *
 * ⚠ できないことも書いておく。ここが確かめるのは「成分が実在し、組み合わせが表に載っているか」
 * までであり、**書かれた作用機序が正しいかは確かめられない**。理由の文面そのものの正しさは
 * 依然としてモデルの知識に依存している。だから出典を添えて、人が確かめられるようにする。
 *
 * シグナル（🔵🟡🔴）は裏取りした理由にそろえる（reconcileSignal）。
 * ⚠ ただし理由が一つも残らない🔴は🔴のまま。何も確かめられないときに安全側を緩めない。
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
  /** 根拠を辿れない・組み合わせが成り立たないとして落とした理由。ログに残して、あとで傾向を見るために返す */
  dropped: Reason[];
  /** 裏取りした理由に合わせて色を変えたとき、その前後（ログ用） */
  adjusted?: { from: Signal; to: Signal };
}

/** 裏取りを通った理由と、その理由が実際に当てはまった在庫 */
interface Confirmed {
  reason: Reason;
  partners: StockItem[];
}

/**
 * 理由を検証し、出典を付け、裏取りした理由に色をそろえて返す。
 *
 * 併せて、これまで route が持っていた2つの上書き（安全に関わる値をモデルに委ねない）も
 * ここに集約する。判定の後始末が1箇所にまとまっていないと、経路が増えたときに片方だけ漏れる。
 */
export function verifyJudgement(
  raw: Judgement,
  extraction: ExtractionResult,
  stock: StockItem[],
): VerifyResult {
  const product = nonEmpty(extraction.ingredients);
  const known = [...product, ...nonEmpty(stock.flatMap((s) => s.ingredients))];

  const confirmed: Confirmed[] = [];
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
    const partners = partnersOf(reason, raw.matched_item_ids, stock);
    const checked = checkPair(reason, traced, product, partners);
    if (!checked) {
      dropped.push(reason);
      continue;
    }
    confirmed.push({
      reason: { ...reason, evidence: checked.evidence },
      partners: checked.partners,
    });
  }

  // 表から引き直すのは、飲む薬どうしだけ。塗る薬は吸収阻害も全身の相互作用も起こさない。
  // 「経口ステロイド × NSAIDs」の例にあるベタメタゾンが、顔に塗る軟膏に当たってしまう
  const oral = isOralForm(extraction.form) ? stock.filter(isTaken) : [];
  const signal = reconcileSignal(raw.signal, confirmed, product, oral);
  const reasons = confirmed.map((c) => c.reason);

  if (signal === raw.signal) {
    return {
      judgement: {
        ...raw,
        // 安全に関わる値をモデル出力に委ねない（§7.4）
        consult_recommended: raw.signal === 'red' ? true : raw.consult_recommended,
        reasons,
      },
      dropped,
    };
  }

  // 色を変えたときは、AIの見出しと説明は別の色を前提に書かれているので、定型文に差し替える
  const top = strongest(confirmed);
  return {
    judgement: {
      signal,
      headline: signal === 'red' ? '注意が必要です' : '買わなくて大丈夫です',
      summary: summaryFor(signal, top),
      matched_item_ids: [...new Set(confirmed.flatMap((c) => c.partners.map((p) => p.id)))],
      reasons,
      consult_recommended: signal === 'red' ? true : raw.consult_recommended,
    },
    dropped,
    adjusted: { from: raw.signal, to: signal },
  };
}

// ── 色をそろえる ─────────────────────────────────────────────────────
//
// AIの色は、AIが書いた理由を前提にしている。その理由を裏取りで落とせば、色だけが
// 根拠を失って残る。実測では、表に無い「イブプロフェン × ミノサイクリン」の相互作用を
// 理由に🔴を返し続けた（Issue #43）。逆に、家のイブA錠と同じ解熱鎮痛薬を🔵にすることもあった。
//
// そこで、色は裏取りした理由に合わせる。
// - 手持ちの表で、家の飲み薬との重複（同じ成分・同じ働き）や吸収阻害・相互作用が分かれば、
//   AIが書いていなくてもその理由を足す（家のイブA錠と同じ解熱鎮痛薬を🔵にした実例がある）
// - 処方薬が相手の理由が残っていれば🔴、重複などの理由だけなら🟡にそろえる
// - **理由が一つも残らない🔴は🔴のまま**にする。何も確かめられないときに安全側を緩めない

const RANK: Record<Signal, number> = { blue: 0, yellow: 1, red: 2 };
const higher = (a: Signal, b: Signal): Signal => (RANK[a] >= RANK[b] ? a : b);

function supports(c: Confirmed): Signal {
  return c.partners.some((p) => p.isPrescription) ? 'red' : 'yellow';
}

function reconcileSignal(
  signal: Signal,
  confirmed: Confirmed[],
  product: string[],
  stock: StockItem[],
): Signal {
  // 手持ちの表で分かるものは、AIが見落としていても拾う。足した理由は confirmed に加える
  for (const found of [...risksInStock(product, stock), ...duplicationsInStock(product, stock)]) {
    const partner = found.partners[0].id;
    const covered = confirmed.some(
      (c) =>
        c.partners.some((p) => p.id === partner) &&
        // 重複は相手ごとに1つで足りる。吸収阻害・相互作用は種類が違えば別に足す
        (isDuplication(found.reason) ? true : c.reason.type === found.reason.type),
    );
    if (!covered) confirmed.push(found);
  }
  // 何も確かめられないときは、AIの色をそのまま使う（🔴を緩めない）
  if (confirmed.length === 0) return signal;

  // 残った理由が支える色にそろえる。下げるのは🔴から🟡だけ
  const backed = confirmed.map(supports).reduce(higher);
  if (signal === 'red' && backed === 'yellow') return 'yellow';
  return higher(signal, backed);
}

const isDuplication = (r: Reason) => r.type === '成分重複' || r.type === '効能重複';

/** 店頭商品が飲むものか。読み取りで剤形が分からなければ飲むものとして扱う */
function isOralForm(form: ExtractionResult['form']): boolean {
  return form === '錠剤' || form === 'カプセル' || form === '不明';
}

/** 在庫が飲むものか。粉薬・シロップは「その他」で登録されるので含める */
function isTaken(item: StockItem): boolean {
  if (item.category === '処方薬(外用)') return false;
  return item.form === '錠剤' || item.form === 'カプセル' || item.form === 'その他';
}

/**
 * 店頭商品と在庫の組に、表の吸収阻害・相互作用が当てはまるか（lib/knowledge.ts）。
 *
 * AIが表にある組み合わせを見落とし、表に無い組み合わせを書くことがある。実測では、
 * 制酸剤入りの鎮痛薬で「アルミニウム × ミノサイクリン」ではなく、表に無い
 * 「イブプロフェン × ミノサイクリン」を理由に挙げた。後者を落とすと🔴の根拠が無くなるので、
 * 表から引き直して足す。
 */
export function risksInStock(product: string[], stock: StockItem[]): Confirmed[] {
  return stock.flatMap((item) =>
    tableRisksBetween(product, nonEmpty(item.ingredients)).map((risk) => ({
      reason: {
        type: risk.type,
        ingredient: risk.ingredient,
        related_item: item.name,
        detail: `家の「${item.name}」について。${risk.detail}`,
        evidence: { label: risk.source, url: PMDA_SEARCH + encodeURIComponent(risk.ingredient) },
      },
      partners: [item],
    })),
  );
}

/**
 * 店頭商品と同じ成分・同じ働きの薬が在庫にあるか（lib/knowledge.ts の同効薬の群で見る）。
 *
 * 群に載っているのは医薬品の有効成分だけなので、化粧品の共通成分（水・グリセリンなど）や
 * 添加物を重複として拾うことはない。在庫1件につき1つの理由にまとめる。
 */
export function duplicationsInStock(product: string[], stock: StockItem[]): Confirmed[] {
  const found: Confirmed[] = [];
  for (const item of stock) {
    for (const ingredient of product) {
      const klass = sharedTherapeuticClass(ingredient, product, item.ingredients);
      if (!klass) continue;
      const theirs = item.ingredients.find((i) =>
        klass.ingredients.some((k) => matchesIngredient(i, k)),
      );
      if (!theirs) continue;
      const same = matchesIngredient(ingredient, theirs);
      found.push({
        reason: {
          type: same ? '成分重複' : '効能重複',
          ingredient,
          related_item: item.name,
          detail: same
            ? `店頭の商品と、家の「${item.name}」の両方に${ingredient}が入っている可能性があります。`
            : `店頭の商品の${ingredient}と、家の「${item.name}」の${theirs}は、どちらも${klass.name}の成分です。重ねて使うと、同じ働きが重なる可能性があります。`,
          evidence: same
            ? searchLink(ingredient)
            : { label: klass.source, url: PMDA_SEARCH + encodeURIComponent(ingredient) },
        },
        partners: [item],
      });
      break;
    }
  }
  return found;
}

/** 説明に使う理由。処方薬が相手のものを先に選ぶ */
function strongest(confirmed: Confirmed[]): Confirmed | undefined {
  return confirmed.find((c) => supports(c) === 'red') ?? confirmed[0];
}

function summaryFor(signal: Signal, top: Confirmed | undefined): string {
  if (!top) return '確かめられた理由はありませんが、念のため使う前に確認してください。';
  const { reason } = top;
  const item = top.partners[0]?.name ?? reason.related_item;
  const what =
    reason.type === '成分重複'
      ? `同じ成分（${reason.ingredient}）`
      : reason.type === '効能重複'
        ? `同じ働きの成分（${reason.ingredient}）`
        : null;
  if (signal === 'red') {
    return what
      ? `処方薬の「${item}」と、${what}が重なる可能性があります。`
      : `処方薬の「${item}」との組み合わせで、注意が必要な可能性があります（${reason.ingredient}）。`;
  }
  return `家にある「${item}」と、${what ?? reason.ingredient}が重なる可能性があります。`;
}

// ── 理由ごとの裏取り ─────────────────────────────────────────────────

function nonEmpty(xs: string[]): string[] {
  return xs.filter((x) => x.trim().length > 0);
}

/**
 * 理由の相手になっている在庫を引く。
 *
 * `related_item` には在庫の商品名をそのまま書くようプロンプトで頼んでいるが、
 * 書き足しや省略があるので名前の部分一致で探す。見つからなければ `matched_item_ids`、
 * それも無ければ在庫全体を相手にする（相手が分からないことを理由に落としはしない）。
 */
export function partnersOf(
  reason: Reason,
  matchedIds: string[],
  stock: StockItem[],
): StockItem[] {
  const written = squash(reason.related_item);
  if (written) {
    const byName = stock.filter((s) => {
      const name = squash(s.name);
      return name.length > 0 && (name.includes(written) || written.includes(name));
    });
    if (byName.length > 0) return byName;
  }
  const byId = stock.filter((s) => matchedIds.includes(s.id));
  return byId.length > 0 ? byId : stock;
}

function squash(s: string): string {
  return s.replace(/[\s　]/g, '').toLowerCase();
}

/**
 * 理由の種類ごとに、店頭商品と相手の在庫の組で成り立つかを確かめる。
 * 成り立てば出典と、実際に当てはまった在庫を返す。成り立たなければ null（その理由は落とす）。
 */
function checkPair(
  reason: Reason,
  traced: string,
  product: string[],
  partners: StockItem[],
): { evidence: NonNullable<Reason['evidence']>; partners: StockItem[] } | null {
  const ruleLink = (source: string) => ({
    label: source,
    url: PMDA_SEARCH + encodeURIComponent(traced),
  });

  switch (reason.type) {
    case '成分重複': {
      // 店頭商品と相手の在庫の両方に入っていなければ重複ではない
      const inProduct = traceIngredient(reason.ingredient, product);
      const holders = partners.filter((p) =>
        traceIngredient(reason.ingredient, nonEmpty(p.ingredients)),
      );
      return inProduct && holders.length > 0
        ? { evidence: searchLink(inProduct), partners: holders }
        : null;
    }
    case '吸収阻害': {
      const hit = partners
        .map((p) => ({ p, rule: findAbsorptionRule(traced, product, nonEmpty(p.ingredients)) }))
        .filter((x) => x.rule);
      return hit.length > 0
        ? { evidence: ruleLink(hit[0].rule!.source), partners: hit.map((x) => x.p) }
        : null;
    }
    case '相互作用': {
      const hit = partners
        .map((p) => ({ p, rule: findInteractionRule(traced, product, nonEmpty(p.ingredients)) }))
        .filter((x) => x.rule);
      return hit.length > 0
        ? { evidence: ruleLink(hit[0].rule!.source), partners: hit.map((x) => x.p) }
        : null;
    }
    case '効能重複': {
      const hit = partners
        .map((p) => ({ p, klass: sharedTherapeuticClass(traced, product, nonEmpty(p.ingredients)) }))
        .filter((x) => x.klass);
      // 表は網羅ではないので、群に無くても落とさない（相手の在庫もそのまま。処方薬なら🔴を支える）
      return hit.length > 0
        ? { evidence: ruleLink(hit[0].klass!.source), partners: hit.map((x) => x.p) }
        : { evidence: searchLink(traced), partners };
    }
    case '刺激リスク': {
      // 刺激の元は店頭商品の側にある。外用薬の成分や保湿剤を挙げた理由は成り立たない
      const inProduct = traceIngredient(reason.ingredient, product);
      if (!inProduct || !IRRITANT_INGREDIENTS.some((i) => matchesIngredient(inProduct, i))) {
        return null;
      }
      // 刺激が問題になるのは、処方の外用薬を使っている部位。確かめに行く先も、
      // 刺激成分よりその外用薬の添付文書（使用上の注意）のほうが役に立つ
      const topical = partners.filter((p) => p.isPrescription && p.category === '処方薬(外用)');
      const prescribed = topical[0]?.ingredients.find((i) => i.trim());
      return { evidence: searchLink(prescribed ?? traced), partners: topical };
    }
  }
}

/** 規則に当てはまらないときの出典。文書名は名乗らず、PMDA の検索の入り口だけを渡す */
function searchLink(ingredient: string): { label: string; url: string } {
  return {
    label: `${ingredient}の添付文書を探す（PMDA）`,
    url: PMDA_SEARCH + encodeURIComponent(ingredient),
  };
}
