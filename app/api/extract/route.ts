import { NextResponse } from 'next/server';
import { fail, upstreamFailure, warmUp } from '@/lib/api';
import { guard } from '@/lib/guard';
import { parseDataUrl } from '@/lib/request';
import { extractIngredients } from '@/lib/llm';

/**
 * 成分抽出のみを行うエンドポイント — 在庫登録用
 *
 * /api/analyze はステップ2（在庫照合）まで走るが、在庫登録では抽出結果だけが要る。
 * ステップ1のプロンプトとスキーマは analyze と共有している（lib/llm.ts）。
 */

export const maxDuration = 60;

/** ウォームアップ（lib/api.ts） */
export const GET = warmUp;

export async function POST(req: Request) {
  const blocked = guard(req, 'extract');
  if (blocked) return blocked;

  let body: { image?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_IMAGE', 'リクエストの形式が正しくありません', 400);
  }

  const image = parseDataUrl(body.image);
  if (!image) {
    return fail('INVALID_IMAGE', '画像を読み込めませんでした。選び直してください', 400);
  }

  try {
    // 呼び出しは失敗したプロバイダを自動で次に落とす（lib/llm.ts）
    const extracted = await extractIngredients(image);
    const extraction = extracted.value;
    if (!extraction || extraction.ingredients.length === 0) {
      return fail(
        'EXTRACTION_FAILED',
        '成分表示を読み取れませんでした。成分表示に寄せて撮り直してください',
        422,
      );
    }
    return NextResponse.json({
      extraction,
      provider: extracted.provider,
      fell_back: Boolean(extracted.fellBackFrom),
    });
  } catch (err) {
    return upstreamFailure(err, 'extract', '読み取りに失敗しました');
  }
}
