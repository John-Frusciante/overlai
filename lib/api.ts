import { NextResponse } from 'next/server';
import { classifyError } from './llm';
import type { ApiErrorCode } from './types';

/**
 * Route Handler の応答の形 — 3つのAPI（analyze / extract / routine）で共有する
 *
 * エラーは必ず `{ error: { code, message } }` で返す。画面側はこの `message` をそのまま出すので、
 * 文言はここで「次にどうすればよいか」が分かる形に揃える（docs/TESTING.md §K）。
 * リクエストの中身の検証は lib/request.ts、入口の検査は lib/guard.ts。ここは出口だけ。
 */

export function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * AI呼び出しの例外を応答に落とす。
 *
 * 種類（lib/llm.ts classifyError）ごとに文言を揃え、原因はログにだけ残す。
 * `fallback` はどれにも当たらないときの文言で、API ごとに「何に失敗したか」を書く。
 */
export function upstreamFailure(err: unknown, label: string, fallback: string) {
  switch (classifyError(err)) {
    case 'rate_limited':
      return fail('RATE_LIMITED', '混み合っています。少し待って再試行してください', 429);
    case 'auth':
      console.error(`[${label}] 認証エラー: APIキーを確認してください`);
      return fail('UPSTREAM_ERROR', '解析サービスに接続できませんでした', 500);
    case 'connection':
      console.error(`[${label}] 接続エラー`, err);
      return fail('UPSTREAM_ERROR', '通信に失敗しました', 500);
    default:
      console.error(`[${label}] unexpected`, err);
      return fail('UPSTREAM_ERROR', fallback, 500);
  }
}

/**
 * ウォームアップ用の GET。何もせず 204 を返す。
 *
 * Vercel の関数は呼ばれずにいると眠り、次の1回目だけ起動に時間がかかる（本番実測 1.7秒 → 0.4秒）。
 * 画面を開いた時点でクライアントが1回叩き（lib/client.ts useWarmUp）、撮影より前に起こしておく。
 * AIは呼ばないので入口の検査も回数制限も通さない。
 */
export function warmUp() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
