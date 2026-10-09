/**
 * 読み取った商品名の扱い — Issue #40
 *
 * 在庫の登録で成分表示を撮ると、AIが商品名も読み取って入力欄に入れる。
 * ただ商品名は読み違えることがあるので、**入れたうえで本人が直せる**ようにする。
 * ここが決めるのは「読み取った名前を入力欄に入れてよいか」だけで、画面は
 * app/stock/new/page.tsx が持つ。
 */

/**
 * 商品名がどこから来たか。
 * - `read`   … 写真から読み取った名前が入っている（まだ直していない）
 * - `unread` … 写真を読んだが商品名は読み取れなかった
 * - `null`   … 手で入れた名前か、まだ何も入っていない
 */
export type NameOrigin = 'read' | 'unread' | null;

export interface NameState {
  name: string;
  origin: NameOrigin;
  /** 手で入れた名前があるときに読み取れた別の名前。上書きせず、選べるようにだけする */
  suggested?: string;
}

/**
 * 読み取った商品名を反映する。**手で入れた名前は上書きしない。**
 *
 * 先に名前を打ってから成分表示を撮る人もいる。読み取りで入れたまま直していない
 * 名前だけを差し替え、手で入れた名前と違うものが読めたら候補として残す。
 * 商品名の写っていない面（成分表示だけ）を撮ったときは、前に読み取った名前を残す。
 */
export function applyReadName(state: NameState, read: string | null): NameState {
  const current = state.name.trim();
  const readName = read?.trim() || null;

  const typed = current !== '' && state.origin !== 'read';
  if (typed) {
    return { ...state, suggested: readName && readName !== current ? readName : undefined };
  }
  if (readName) return { name: readName, origin: 'read' };
  return current ? state : { name: state.name, origin: 'unread' };
}

/** 本人が入れた・直した名前。読み取りの添え書きと候補を消す */
export function typeName(value: string): NameState {
  return { name: value, origin: null };
}
