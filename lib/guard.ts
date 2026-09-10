import { NextResponse } from 'next/server';
import type { ApiErrorCode } from './types';

/**
 * APIの入口 — 学校配布のキーを第三者に使わせないための最低限
 *
 * このアプリのAIは、学校から配布された Azure プロキシのキーで動いている。
 * `/api/analyze` は画像1枚につき Vision と判定で2回モデルを呼ぶので、
 * URLさえ知っていれば誰でもそのキーの枠を消費できる状態だった（実測: 本番へ curl で 200）。
 *
 * ここで見るのは2つ。
 *
 * 1. **どこから来たか。** ブラウザは POST に必ず `Origin` を付ける。
 *    自分のサイト以外から来たリクエストは断る。curl は `Origin` を付けないので同時に落ちる。
 * 2. **どれだけ来たか。** 同じ相手からの短時間の連打を断る。
 *
 * ⚠ これは鍵ではなく**入口の戸締まり**である。`Origin` は詐称できるし、
 * インスタンスをまたぐと下の計数はリセットされる。本気で守るなら Vercel WAF の
 * レート制限を併用すること（docs/DEVELOPMENT.md §6）。それでも、
 * 「URLを知っていれば無条件に使える」状態ではなくなる。
 *
 * ⚠ 実機の PWA（standalone 起動）を弾かないこと。
 * ホーム画面から起動した場合も `Origin` は本番のオリジンになるため素通りする。
 * 検証にはローカルの `npm run dev` と、本番URLへの curl の両方を使う（docs/TESTING.md §I）。
 */

/** 追加で許可するオリジン。カンマ区切り。プレビュー環境や独自ドメインを足すときに使う */
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 同じ相手から、この時間内に、この回数まで */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 30;

/**
 * 直近のアクセス記録。プロセス内にしか無い。
 *
 * Vercel の Fluid Compute はインスタンスを使い回すので、連打はおおむね同じ箱に当たる。
 * ただし保証はない。取りこぼしても致命的にならない用途にだけ使うこと。
 */
const hits = new Map<string, number[]>();

function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * 通してよいリクエストかを見る。断るときだけレスポンスを返す。
 * 通ってよければ `null` を返すので、呼び出し側は `if (blocked) return blocked;` と書く。
 */
export function guard(req: Request, label: string): NextResponse | null {
  if (!isSameSite(req)) {
    console.warn(`[${label}] 別オリジンからの呼び出しを断りました`, {
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
    });
    return fail('FORBIDDEN', 'このページからのみ利用できます', 403);
  }

  if (isTooMany(clientKey(req))) {
    console.warn(`[${label}] 短時間に多すぎるため断りました`);
    return fail('RATE_LIMITED', '短い時間に何度も実行されました。少し待ってください', 429);
  }

  return null;
}

/** 自分のサイトから来たリクエストか */
export function isSameSite(req: Request): boolean {
  // ローカル開発では素通りさせる。dev で弾かれると原因を追いにくい
  if (process.env.NODE_ENV !== 'production') return true;

  const host = req.headers.get('host');
  if (!host) return false;

  const origin = req.headers.get('origin');
  if (origin) return hostOf(origin) === host || EXTRA_ORIGINS.includes(origin);

  // Origin が無い場合の保険。ブラウザの POST には通常付くので、
  // ここに来るのは fetch 以外の経路（フォーム送信など）に限られる
  const referer = req.headers.get('referer');
  if (referer) return hostOf(referer) === host;

  // Origin も Referer も無い ＝ ブラウザ以外からの呼び出し
  return false;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** 相手の識別。プロキシ越しなので、Vercel が付ける転送元アドレスを見る */
function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

function isTooMany(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // 放っておくと古い相手の記録が残り続ける。件数が増えたときだけ掃除する
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return recent.length > MAX_REQUESTS;
}
