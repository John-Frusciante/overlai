import { NextResponse } from 'next/server';
import { activeProvider, adviseRoutine, classifyError } from '@/lib/llm';
import { MOCK_ROUTINE_ADVICE } from '@/lib/mock';
import { sanitizeProfile, sanitizeStock } from '@/lib/request';
import { buildRoutine } from '@/lib/routine';
import type { RoutineAdvice } from '@/lib/types';

/**
 * ルーティンの解説を生成するエンドポイント
 *
 * 並び順はここでもルール（lib/routine.ts）で組み直す。
 * クライアントが送ってきた順序を信じると、順序をAIに委ねないという前提が
 * クライアント側の実装次第で崩れるため。AIに渡すのは組み終えた順序であり、
 * 返ってくるのは各ステップの一言だけ（lib/schemas.ts RoutineAdviceSchema）。
 *
 * 解説が無くてもルーティン画面は成立するので、失敗はクライアント側で黙って捨てる。
 */

export const maxDuration = 60;

const EMPTY: RoutineAdvice = { overall: '', steps: [] };

export async function POST(req: Request) {
  let body: { stock?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_IMAGE', message: 'リクエストの形式が正しくありません' } },
      { status: 400 },
    );
  }

  const stock = sanitizeStock(body.stock);
  if (!stock) {
    return NextResponse.json(
      { error: { code: 'EMPTY_STOCK', message: 'ストックがありません' } },
      { status: 400 },
    );
  }

  const profile = sanitizeProfile(body.profile);
  const inbath = buildRoutine(stock, 'inbath');
  const outbath = buildRoutine(stock, 'outbath');

  // 洗う・塗るものが1つも無いなら解説することがない。AIを呼ばずに返す
  if (inbath.length === 0 && outbath.length === 0) {
    return NextResponse.json({ advice: EMPTY });
  }

  const toEntry = (s: { item: (typeof stock)[number] }) => ({
    id: s.item.id,
    name: s.item.name,
    form: s.item.form,
    ingredients: s.item.ingredients,
    isPrescription: s.item.isPrescription,
  });

  const input = {
    profile,
    inbath: inbath.map(toEntry),
    outbath: outbath.map(toEntry),
    meds: stock
      .filter((i) => i.dose && i.dose.times.length > 0)
      .map((i) => ({ name: i.name, times: i.dose!.times as string[], isPrescription: i.isPrescription })),
  };

  const provider = activeProvider();

  if (provider === 'mock') {
    console.warn('[routine] モックモードで応答しています（APIキー未設定）');
    return NextResponse.json({ advice: MOCK_ROUTINE_ADVICE, provider, mocked: true });
  }

  try {
    const advised = await adviseRoutine(input);
    return NextResponse.json({
      advice: advised.value ?? EMPTY,
      provider: advised.provider,
      fell_back: Boolean(advised.fellBackFrom),
    });
  } catch (err) {
    if (classifyError(err) === 'rate_limited') {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: '混み合っています。少し待って再試行してください' } },
        { status: 429 },
      );
    }
    console.error('[routine] error', err);
    return NextResponse.json(
      { error: { code: 'UPSTREAM_ERROR', message: 'アドバイスを取得できませんでした' } },
      { status: 500 },
    );
  }
}
