'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

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

/**
 * 判定APIの関数を先に起こしておく（#24）。
 *
 * Vercel の関数は呼ばれずにいると眠り、次の1回目だけ起動に時間がかかる
 * （2026年9月15日の実測: 本番で 1.7秒 → 2回目 0.4秒）。撮影の構図を決めている数秒のあいだに
 * 空の GET を1回投げておけば、撮ったときには起きている。結果は使わないので失敗も無視する。
 * 呼ぶ先は `GET` を持つ Route Handler だけ（app/api/analyze・app/api/extract）。
 */
export function useWarmUp(path: '/api/analyze' | '/api/extract'): void {
  useEffect(() => {
    fetch(path, { method: 'GET', cache: 'no-store', keepalive: true }).catch(() => {});
  }, [path]);
}

/**
 * JSON の本文を伴わない失敗。サーバーの文言が無いので状態コードから組み立てる。
 * 502〜504 は Vercel か会場の回線が途中で切った場合で、撮り直しても直らないことが多い。
 */
export function describeHttpFailure(status: number): string {
  if (status === 502 || status === 503 || status === 504) {
    return '応答が返ってきませんでした。少し時間をおいて、もう一度お試しください';
  }
  return '判定に失敗しました。もう一度お試しください';
}

/** fetch 自体が失敗したとき。オフラインと時間切れは、次にどうすればよいかが違う */
export function describeFetchFailure(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return '時間がかかりすぎたため中断しました。電波の良い場所で、もう一度お試しください';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'オフラインです。通信環境を確認してから、もう一度お試しください';
  }
  return '通信に失敗しました。電波の状況を確認してから、もう一度お試しください';
}

/** 選んだ画像をブラウザが読めなかったとき（壊れた画像・未対応の形式） */
export const UNREADABLE_IMAGE = '画像を読み込めませんでした。別の画像を選ぶか、撮り直してください';
