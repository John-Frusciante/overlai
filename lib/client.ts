'use client';

import { useState, useSyncExternalStore } from 'react';

/**
 * 端末に保存された値を React に持ち込むためのフック
 *
 * localStorage はサーバーには無い。だから最初の描画は必ず初期値になり、
 * 端末の中身はそのあとで反映するしかない。これまでは `useEffect` の中で
 * `setState(load())` と書いていたが、これは React が明示的に避けろと言っている形で、
 * `npm run lint` も9件落としていた（`react-hooks/set-state-in-effect`）。
 * 描画のたびに更新が連鎖しうるため。
 *
 * ここでは React の外に小さな入れ物を作り、`useSyncExternalStore` で購読する。
 * サーバー側の描画とハイドレーションでは初期値を返し、そのあと初めて端末の値を読む。
 * 読んだ値は入れ物の中に持つので、再描画のたびに localStorage を読み直すことはない。
 *
 * 読んだあとは普通の state と同じように書き換えられる。
 * 端末側への保存は `lib/storage.ts` の関数が行い、その戻り値をここへ渡す
 * （画面から localStorage を直接触らない、という約束は変わらない）。
 */

/** React の外に置く入れ物。読み込みは初めて必要になったときの1回だけ */
function createStore<T>(load: () => T, fallback: T) {
  let cached: { value: T } | null = null;
  const listeners = new Set<() => void>();

  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    /** クライアント側の値。同じ内容なら同じ参照を返す必要があるためキャッシュする */
    get(): T {
      if (!cached) cached = { value: load() };
      return cached.value;
    },
    /** サーバー側の値。端末の中身は見えないので初期値 */
    getServer(): T {
      return fallback;
    },
    set(next: T | ((prev: T) => T)) {
      const base = cached ? cached.value : fallback;
      cached = { value: typeof next === 'function' ? (next as (prev: T) => T)(base) : next };
      for (const fn of listeners) fn();
    },
  };
}

export function useStoredState<T>(
  load: () => T,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  // 入れ物はコンポーネントの一生に1つ。load を後から差し替えることは想定していない
  const [store] = useState(() => createStore(load, fallback));
  const value = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  return [value, store.set];
}

/** クライアントで描画されているか。SSR とハイドレーションの間は false */
export function useIsClient(): boolean {
  const [store] = useState(() => createStore(() => true, false));
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}
