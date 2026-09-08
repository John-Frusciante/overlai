'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JudgementCard } from '@/components/JudgementCard';
import { toResizedDataUrl } from '@/lib/image';
import { loadStock } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { AnalyzeResponse, ApiErrorBody, StockItem } from '@/lib/types';

/** スキャン画面 — 設計仕様書 §9.3 */

type Phase = 'idle' | 'extracting' | 'judging' | 'error' | 'done';

/**
 * ステップ1が終わるまでは必ず「読み取り中」なので、経過時間で表示を切り替える。
 * APIは1リクエストのため、これは実測の進捗ではなく所要時間に基づく提示である。
 * 2段階に切り替えること自体が仕様（§9.3）— パイプラインが2段構成であることを画面で示す。
 */
const JUDGING_SWITCH_MS = 4000;

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  const [phase, setPhase] = useState<Phase>('idle');
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    setStock(loadStock());
  }, []);

  // カメラ起動（FR-03）。失敗しても画像選択で完走できるため致命的ではない
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        setCameraReady(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const analyze = useCallback(
    async (dataUrl: string) => {
      setPhase('extracting');
      const timer = setTimeout(() => setPhase('judging'), JUDGING_SWITCH_MS);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, stock }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          setErrorMsg(body?.error.message ?? '判定に失敗しました');
          setPhase('error');
          return;
        }
        setResult((await res.json()) as AnalyzeResponse);
        setPhase('done');
      } catch {
        setErrorMsg('通信に失敗しました');
        setPhase('error');
      } finally {
        clearTimeout(timer);
      }
    },
    [stock],
  );

  const shoot = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (blob) await analyze(await toResizedDataUrl(blob));
  }, [analyze]);

  const pickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) await analyze(await toResizedDataUrl(file));
    },
    [analyze],
  );

  const busy = phase === 'extracting' || phase === 'judging';

  return (
    <main className="relative min-h-dvh bg-zinc-900">
      {/* カメラビュー */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
          <p className="text-[14px] leading-relaxed text-zinc-400">
            カメラを利用できません。
            <br />
            下の「画像を選ぶ」から撮影済みの写真を選んでください。
          </p>
        </div>
      )}

      {/* ガイド枠 */}
      {cameraReady && !busy && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="h-56 w-[78%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <p className="mt-5 text-[14px] font-medium text-white drop-shadow">
            成分表示をこの枠に入れてください
          </p>
        </div>
      )}

      {/* 2段階ローディング — §9.3 */}
      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-10">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
          <p className="mt-6 text-[15px] font-semibold text-white">
            {phase === 'extracting' ? '成分を読み取っています…' : '家の在庫と照合しています…'}
          </p>
          <div className="mt-4 flex gap-1.5">
            <span className="h-1 w-8 rounded-full bg-white" />
            <span
              className={`h-1 w-8 rounded-full ${phase === 'judging' ? 'bg-white' : 'bg-white/25'}`}
            />
          </div>
        </div>
      )}

      {/* エラー — §8.1 / FR-11 */}
      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-8 text-center">
          <p className="text-[15px] leading-relaxed text-white">{errorMsg}</p>
          <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
            <button
              onClick={() => setPhase('idle')}
              className="rounded-xl bg-white py-3 text-[15px] font-semibold text-zinc-900 active:bg-zinc-200"
            >
              もう一度撮る
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-white/30 py-3 text-[15px] font-medium text-white active:bg-white/10"
            >
              画像を選ぶ
            </button>
          </div>
        </div>
      )}

      {/* 操作バー */}
      {!busy && phase !== 'error' && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-8 pb-11">
          <button
            onClick={() => router.push('/')}
            className="text-[14px] font-medium text-white/80 active:text-white"
          >
            閉じる
          </button>

          <button
            onClick={shoot}
            disabled={!cameraReady}
            aria-label="撮影"
            className="h-[70px] w-[70px] rounded-full border-4 border-white/90 bg-white/25 disabled:opacity-30 active:scale-95"
          />

          {/* 画像選択は常時表示（FR-04）— 実機デモで最も事故が起きるのはカメラ */}
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[14px] font-medium text-white/80 active:text-white"
          >
            画像を選ぶ
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={pickFile}
        className="hidden"
      />

      {phase === 'done' && result && (
        <JudgementCard
          result={result}
          stock={stock}
          onClose={() => {
            setResult(null);
            setPhase('idle');
          }}
        />
      )}
    </main>
  );
}
