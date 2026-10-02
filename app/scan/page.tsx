'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Images, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { JudgementCard } from '@/components/JudgementCard';
import {
  UNREADABLE_IMAGE,
  describeFetchFailure,
  describeHttpFailure,
  useStoredState,
  useWarmUp,
} from '@/lib/client';
import { coverCrop, toResizedDataUrl } from '@/lib/image';
import { insertStock, loadProfile, loadStock, removeStock, savePendingScan } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { AnalyzeResponse, ApiErrorBody, Profile, StockItem } from '@/lib/types';

/** スキャン画面 — 設計仕様書 §9.3 */

type Phase = 'idle' | 'extracting' | 'judging' | 'error' | 'done';

/**
 * ステップ1が終わるまでは必ず「読み取り中」なので、経過時間で表示を切り替える。
 * APIは1リクエストのため、これは実測の進捗ではなく所要時間に基づく提示である。
 * 2段階に切り替えること自体が仕様（§9.3）— パイプラインが2段構成であることを画面で示す。
 */
const JUDGING_SWITCH_MS = 4000;

/**
 * サーバーは60秒（`maxDuration`）で打ち切られるので、それより後まで待っても何も来ない。
 * 会場の回線で接続だけが宙に浮いたとき、読み込み画面のまま固まらないための上限。
 */
const CLIENT_TIMEOUT_MS = 70_000;

/**
 * `?demo=` は Next のルーターから受け取る（`useSearchParams`）。
 * `window.location.search` を描画中に読むと、クライアント遷移では遷移前のURLが返る
 * （app-router は履歴を `useInsertionEffect` で書き換えるため）。
 */
export default function ScanPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0b0d12]" />}>
      <Scanner />
    </Suspense>
  );
}

function Scanner() {
  const router = useRouter();
  // 固定応答のシナリオ指定（?demo=yellow|red|blue）。展示中にAIが使えなくなったときの逃げ道
  const demo = useSearchParams().get('demo');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);

  const [stock, setStock] = useStoredState<StockItem[]>(loadStock, SEED_STOCK);
  const [profile] = useStoredState<Profile>(loadProfile, {});
  const [phase, setPhase] = useState<Phase>('idle');
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emptyStock, setEmptyStock] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  /** 判定だけをやり直している最中か（「もう家に無い」） */
  const [rejudging, setRejudging] = useState(false);
  /** 直前に外したもの。「元に戻す」で在庫も判定も外す前に戻す */
  const [removed, setRemoved] = useState<{
    item: StockItem;
    index: number;
    before: AnalyzeResponse;
  } | null>(null);
  /** 判定が今の在庫に合っていないときの説明 */
  const [stale, setStale] = useState<string | null>(null);

  // 構図を決めているあいだに判定APIの関数を起こしておく（#24）
  useWarmUp('/api/analyze');

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

  /** 判定APIを呼ぶ。成功なら結果、失敗なら画面に出す文言を返す */
  const requestJudgement = useCallback(
    async (
      payload: { image: string } | { extraction: AnalyzeResponse['extraction'] },
      items: StockItem[],
    ): Promise<
      | { ok: true; result: AnalyzeResponse }
      | { ok: false; message: string; emptyStock: boolean }
    > => {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, stock: items, demo }),
          signal: controller.signal,
        });
        if (!res.ok) {
          // サーバーの文言があればそれを出す。無いのは Vercel が関数ごと打ち切った 504 など
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          return {
            ok: false,
            message: body?.error.message ?? describeHttpFailure(res.status),
            emptyStock: body?.error.code === 'EMPTY_STOCK',
          };
        }
        return { ok: true, result: (await res.json()) as AnalyzeResponse };
      } catch (err) {
        return { ok: false, message: describeFetchFailure(err), emptyStock: false };
      } finally {
        clearTimeout(abortTimer);
      }
    },
    [demo],
  );

  const analyze = useCallback(
    async (dataUrl: string) => {
      setPhase('extracting');
      setRemoved(null);
      setStale(null);
      const timer = setTimeout(() => setPhase('judging'), JUDGING_SWITCH_MS);
      const outcome = await requestJudgement({ image: dataUrl }, stock);
      clearTimeout(timer);
      if (!outcome.ok) {
        setErrorMsg(outcome.message);
        setEmptyStock(outcome.emptyStock);
        setPhase('error');
        return;
      }
      setResult(outcome.result);
      setPhase('done');
    },
    [requestJudgement, stock],
  );

  /**
   * 「もう家に無い」— 在庫から外し、判定だけをやり直す（Issue #35）。
   * 確認は挟まない。代わりに「元に戻す」で取り返せるようにする。
   */
  const removeAndRejudge = useCallback(
    async (item: StockItem) => {
      if (!result || rejudging) return;
      const index = stock.findIndex((i) => i.id === item.id);
      const next = removeStock(item.id);
      setStock(next);
      // 「元に戻す」で戻せるのは直前の1件だけ。判定も直前のものに戻す
      setRemoved({ item, index, before: result });

      if (next.length === 0) {
        setStale('照合する在庫がなくなりました');
        return;
      }

      setRejudging(true);
      const outcome = await requestJudgement({ extraction: result.extraction }, next);
      setRejudging(false);
      if (outcome.ok) {
        setResult(outcome.result);
        setStale(null);
      } else {
        // 古い判定をそのまま見せると、外したはずの薬の警告が残って見える
        setStale(
          `在庫は外しましたが、判定をやり直せませんでした（${outcome.message}）。この判定は外す前の在庫に基づいています。もう一度撮ると判定し直します`,
        );
      }
    },
    [result, rejudging, stock, setStock, requestJudgement],
  );

  /** 直前に外したものを戻し、判定も外す前に戻す。AIは呼ばない */
  const undoRemove = useCallback(() => {
    if (!removed || rejudging) return;
    setStock(insertStock(removed.item, removed.index));
    setResult(removed.before);
    setRemoved(null);
    setStale(null);
  }, [removed, rejudging, setStock]);

  /** 「買ったので在庫に入れる」— 読み取り結果を持って追加画面へ */
  const addToStock = useCallback(() => {
    if (!result) return;
    savePendingScan(result.extraction);
    router.push('/stock/new?from=scan');
  }, [result, router]);

  /**
   * 縮小して送る。**画像が読めなかったときに、何も起きないまま止まらない。**
   * `createImageBitmap` は壊れた画像や未対応の形式で例外を投げる。以前はそれが
   * 未処理のまま消え、押しても反応しない画面になっていた（2026年9月15日に WebKit で再現）。
   */
  const submit = useCallback(
    async (source: Blob) => {
      let dataUrl: string;
      try {
        dataUrl = await toResizedDataUrl(source);
      } catch {
        setEmptyStock(false);
        setErrorMsg(UNREADABLE_IMAGE);
        setPhase('error');
        return;
      }
      await analyze(dataUrl);
    },
    [analyze],
  );

  /**
   * 撮影。**ガイド枠の中だけを切り出して送る。**
   *
   * これまでは全画面を送っていたので、枠に入れてもらった意味が無かった。
   * 送る前に長辺 1568px へ縮めるため、成分表示が画面の一角にしか写っていないと
   * その時点で文字が潰れる。枠で切ってから縮めれば、同じ 1568px に文字が大きく収まる。
   * 枠の計算が取れなかったときは、これまでどおり全画面を送る。
   */
  const shoot = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const guide = guideRef.current?.getBoundingClientRect();
    const crop = guide
      ? coverCrop(
          { width: video.videoWidth, height: video.videoHeight },
          video.getBoundingClientRect(),
          guide,
        )
      : null;

    const area = crop ?? { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
    const canvas = document.createElement('canvas');
    canvas.width = area.width;
    canvas.height = area.height;
    canvas
      .getContext('2d')
      ?.drawImage(
        video,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        area.width,
        area.height,
      );

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (blob) await submit(blob);
  }, [submit]);

  const pickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) await submit(file);
    },
    [submit],
  );

  const busy = phase === 'extracting' || phase === 'judging';

  return (
    <main className="relative min-h-dvh bg-[#0b0d12]">
      {/* カメラビュー */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
          <p className="text-[14px] leading-relaxed text-white/55">
            カメラを利用できません。
            <br />
            下の「画像を選ぶ」から撮影済みの写真を選んでください。
          </p>
        </div>
      )}

      {/* ガイド枠。四隅のコーナーマークで囲む。**この中だけを送る**（shoot） */}
      {cameraReady && !busy && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            ref={guideRef}
            className="relative h-[42vh] max-h-[380px] w-[86%] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
          >
            {[
              'left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-2xl',
              'right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-2xl',
              'left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-2xl',
              'right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-2xl',
            ].map((c) => (
              <span key={c} className={`absolute h-9 w-9 border-white/90 ${c}`} />
            ))}
          </div>
          <div className="mt-6 px-8 text-center">
            <p className="text-[14px] font-medium text-white/95 drop-shadow">
              成分表示が枠いっぱいになるまで近づけてください
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">
              送るのは枠の中だけです。文字が小さいと読み取れないことがあります
            </p>
          </div>
        </div>
      )}

      {/* 2段階ローディング — §9.3
          パイプラインが2段構成であることを画面で示す。これは演出ではなく仕様。 */}
      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/78 px-9 backdrop-blur-sm">
          <ol className="w-full max-w-[280px] space-y-3">
            <PipelineStep
              label="成分を読み取っています"
              state={phase === 'extracting' ? 'active' : 'done'}
            />
            <PipelineStep
              label="家の在庫と照合しています"
              state={phase === 'judging' ? 'active' : 'waiting'}
            />
          </ol>
        </div>
      )}

      {/* エラー — §8.1 / FR-11 */}
      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-8 text-center">
          <p className="text-[15px] leading-relaxed text-white">{errorMsg}</p>
          <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
            <button
              onClick={() => setPhase('idle')}
              className="rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98]"
            >
              もう一度撮る
            </button>
            {emptyStock ? (
              <button
                onClick={() => router.push('/stock/new')}
                className="rounded-2xl border border-white/25 py-3.5 text-[15px] font-medium text-white transition-transform active:scale-[0.98] active:bg-white/10"
              >
                ストックを追加する
              </button>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-2xl border border-white/25 py-3.5 text-[15px] font-medium text-white transition-transform active:scale-[0.98] active:bg-white/10"
              >
                画像を選ぶ
              </button>
            )}
          </div>
        </div>
      )}

      {/* 操作バー */}
      {!busy && phase !== 'error' && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-8 pb-safe">
          <button
            onClick={() => router.push('/')}
            className="w-[52px] text-[13.5px] font-medium text-white/80 transition-transform active:scale-95 active:text-white"
          >
            閉じる
          </button>

          <button
            onClick={shoot}
            disabled={!cameraReady}
            aria-label="撮影"
            className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-[3px] border-white/90 transition-transform duration-150 active:scale-90 disabled:opacity-30"
          >
            <span className="h-[58px] w-[58px] rounded-full bg-white shadow-[0_2px_12px_rgba(255,255,255,0.35)]" />
          </button>

          {/* 画像選択は常時表示（FR-04）— 実機デモで最も事故が起きるのはカメラ */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-1 text-white/80 transition-transform active:scale-95 active:text-white"
          >
            <Images size={20} strokeWidth={1.9} />
            <span className="text-[11px] font-medium">画像を選ぶ</span>
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
          profile={profile}
          onRemoveItem={result.mocked ? undefined : removeAndRejudge}
          onAddToStock={result.mocked ? undefined : addToStock}
          pending={rejudging}
          removed={removed ? { name: removed.item.name, onUndo: undoRemove } : null}
          stale={stale}
          onClose={() => {
            setResult(null);
            setRemoved(null);
            setStale(null);
            setPhase('idle');
          }}
        />
      )}
    </main>
  );
}

/** パイプラインの各段。2段構成であることが映像で伝わるようにする */
function PipelineStep({
  label,
  state,
}: {
  label: string;
  state: 'waiting' | 'active' | 'done';
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
          state === 'done'
            ? 'bg-white text-ink'
            : state === 'active'
              ? 'bg-white/15 text-white'
              : 'border border-white/20 text-white/30'
        }`}
      >
        {state === 'done' ? (
          <Check size={14} strokeWidth={3} />
        ) : state === 'active' ? (
          <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
        ) : null}
      </span>
      <span
        className={`text-[14.5px] font-medium transition-colors ${
          state === 'waiting' ? 'text-white/35' : 'text-white'
        }`}
      >
        {label}
      </span>
    </li>
  );
}
