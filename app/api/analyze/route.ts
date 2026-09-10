import { NextResponse } from 'next/server';
import { guard } from '@/lib/guard';
import { MOCK_FIXTURES, isSignal } from '@/lib/mock';
import { parseDataUrl, sanitizeStock } from '@/lib/request';
import {
  activeProvider,
  classifyError,
  extractIngredients,
  judgeAgainstStock,
} from '@/lib/llm';
import type { ApiErrorCode, Judgement } from '@/lib/types';

/**
 * 判定API — 設計仕様書 §7・§8
 *
 * 抽出（ステップ1）と判定（ステップ2）をサーバー側で直列実行する。
 * エンドポイントを1本に集約しているのは、分割すると往復が2回になりレイテンシが倍増するため（§8.3）。
 * 2段階に分ける設計思想はパイプラインの話であって、エンドポイント数の話ではない。
 *
 * どのAIを使うかは lib/llm.ts が環境変数から決める。APIキーはサーバー側でのみ読む（NFR-05）。
 * 入口の戸締まり（別オリジンからの呼び出しと連打）は lib/guard.ts が見る。
 */

export const maxDuration = 60;

function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  const started = Date.now();

  // 学校配布キーを第三者に使わせないための入口の検査（lib/guard.ts）
  const blocked = guard(req, 'analyze');
  if (blocked) return blocked;

  let body: { image?: unknown; stock?: unknown; demo?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_IMAGE', 'リクエストの形式が正しくありません', 400);
  }

  const image = parseDataUrl(body.image);
  if (!image) {
    return fail('INVALID_IMAGE', '画像を読み込めませんでした。選び直してください', 400);
  }

  // 在庫が空のときは「不正」ではなく、登録を促す案内にする
  if (!Array.isArray(body.stock) || body.stock.length === 0) {
    return fail(
      'EMPTY_STOCK',
      'マイストックが空です。先にストックを追加してください',
      400,
    );
  }

  const stock = sanitizeStock(body.stock);
  if (!stock) {
    return fail('INVALID_IMAGE', '在庫データが不正です', 400);
  }

  const provider = activeProvider();

  // ── モック応答 ──────────────────────────────────────────────────
  // AIを呼ばない。デモ動画の撮影とUI確認のための経路。
  if (provider === 'mock') {
    console.warn('[analyze] モックモードで応答しています（APIキー未設定）');
    const scenario = isSignal(body.demo) ? body.demo : 'yellow';
    // 2段階ローディングが映る程度の待ち時間を入れる
    await new Promise((r) => setTimeout(r, 5200));
    return NextResponse.json({
      ...MOCK_FIXTURES[scenario],
      elapsed_ms: Date.now() - started,
      provider,
      mocked: true,
    });
  }

  try {
    // ── ステップ1: 成分抽出（Vision） ────────────────────────────────
    // 呼び出しは失敗したプロバイダを自動で次に落とす（lib/llm.ts）
    const extracted = await extractIngredients(image);
    const extraction = extracted.value;
    if (!extraction) {
      return fail('UPSTREAM_ERROR', '成分の解析に失敗しました', 500);
    }

    // ingredients が空なら照合できない。confidence は条件に含めない（§8.1）
    if (extraction.ingredients.length === 0) {
      return fail(
        'EXTRACTION_FAILED',
        '成分表示を読み取れませんでした。成分表示に寄せて撮り直してください',
        422,
      );
    }

    // ── ステップ2: 在庫照合判定 ──────────────────────────────────────
    const judged = await judgeAgainstStock(extraction, stock);
    const raw = judged.value;
    if (!raw) {
      return fail('UPSTREAM_ERROR', '判定に失敗しました', 500);
    }

    // 安全に関わる値をモデル出力に委ねない（§7.4）
    const judgement: Judgement = {
      ...raw,
      consult_recommended: raw.signal === 'red' ? true : raw.consult_recommended,
      // 成分名のない理由は根拠として成立しないため落とす
      reasons: raw.reasons.filter((r) => r.ingredient.trim().length > 0),
    };

    return NextResponse.json({
      extraction,
      judgement,
      elapsed_ms: Date.now() - started,
      // 実際に判定を返したプロバイダ。フォールバックが起きると第一候補とは変わる
      provider: judged.provider,
      fell_back: Boolean(extracted.fellBackFrom ?? judged.fellBackFrom),
    });
  } catch (err) {
    switch (classifyError(err)) {
      case 'rate_limited':
        return fail('RATE_LIMITED', '混み合っています。少し待って再試行してください', 429);
      case 'auth':
        console.error('[analyze] 認証エラー: APIキーを確認してください');
        return fail('UPSTREAM_ERROR', '解析サービスに接続できませんでした', 500);
      case 'connection':
        console.error('[analyze] 接続エラー', err);
        return fail('UPSTREAM_ERROR', '通信に失敗しました', 500);
      default:
        console.error('[analyze] unexpected', err);
        return fail('UPSTREAM_ERROR', '解析サービスでエラーが発生しました', 500);
    }
  }
}
