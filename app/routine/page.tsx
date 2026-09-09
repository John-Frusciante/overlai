'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CleanserMatchRow, ProfilePrompt } from '@/components/CleanserMatchCard';
import {
  buildRoutine,
  countInRoutine,
  findConflicts,
  isBuiltinRoutine,
  isReordered,
  orderedRoutines,
  routineCaption,
  routineChipLabel,
  routineTitle,
} from '@/lib/routine';
import { isCleanser } from '@/lib/cleanser';
import { matchCleanser } from '@/lib/cleanser';
import {
  doseKey,
  loadDoseLog,
  loadProfile,
  loadRecentDoseLogs,
  loadCustomRoutines,
  loadRoutineAdvice,
  loadStock,
  moveRoutine,
  reorderRoutine,
  resetRoutineOrder,
  routineSignature,
  saveCustomRoutines,
  saveRoutineAdvice,
  toggleDose,
  todayKey,
} from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import { categoryStyle } from '@/lib/ui';
import type {
  DoseLog,
  DoseTime,
  Profile,
  RoutineAdvice,
  RoutineAdviceResponse,
  RoutineKind,
  RoutineStep,
  StockItem,
} from '@/lib/types';

/**
 * 今日のルーティン — 企画書「画面は3つ」の3画面目
 *
 * 「買うときだけのアプリ」で終わらせないための画面。
 * 在庫が入っていれば、店頭判定だけでなく毎日の使い方まで案内できる。
 */

const TIMES: DoseTime[] = ['朝', '昼', '夜'];

export default function RoutinePage() {
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  const [log, setLog] = useState<DoseLog>({ date: todayKey(), taken: [] });
  const [profile, setProfile] = useState<Profile>({});
  const [history, setHistory] = useState<DoseLog[]>([]);
  /** localStorage を読み終えたか。読む前にAIを呼ぶとシードの内容で生成してしまう */
  const [loaded, setLoaded] = useState(false);

  const [advice, setAdvice] = useState<RoutineAdvice | null>(null);
  const [advising, setAdvising] = useState(false);
  /** 並べ替え中の区分。null なら通常表示 */
  const [reordering, setReordering] = useState<RoutineKind | null>(null);
  /** ユーザーが作った区分。組み込みの2つの後ろに並ぶ */
  const [customRoutines, setCustomRoutines] = useState<string[]>([]);

  useEffect(() => {
    setStock(loadStock());
    setLog(loadDoseLog());
    setProfile(loadProfile());
    setHistory(loadRecentDoseLogs(7));
    setCustomRoutines(loadCustomRoutines());
    setLoaded(true);
  }, []);

  /**
   * ステップを1つ上下に動かす。
   *
   * その区分の全件に順番を書き込むので、以降はこの並びが優先される
   * （剤形の重みは「まだ動かしていないもの」の並びに使われ続ける）。
   */
  const onMove = useCallback((steps: RoutineStep[], from: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const ids = steps.map((s) => s.item.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setStock(reorderRoutine(ids));
  }, []);

  const onResetOrder = useCallback((kind: RoutineKind) => {
    setStock(resetRoutineOrder(kind));
  }, []);

  /** 区分を消す。中身は移動先へ回すか、ルーティンから外すだけで、在庫は消さない */
  const onRemoveRoutine = useCallback((name: string, moveTo?: RoutineKind) => {
    setStock(moveRoutine(name, moveTo));
    const next = loadCustomRoutines().filter((n) => n !== name);
    saveCustomRoutines(next);
    setCustomRoutines(next);
    setReordering(null);
  }, []);

  const onToggle = useCallback((item: StockItem, time: DoseTime) => {
    const { log: nextLog, stock: nextStock } = toggleDose(item, time);
    setLog(nextLog);
    setStock(nextStock);
    setHistory(loadRecentDoseLogs(7));
  }, []);

  const meds = stock.filter((i) => i.dose && i.dose.times.length > 0);

  // 組み込みの2区分 → ユーザーが作った区分 → 在庫にしか残っていない区分の順
  const sections = orderedRoutines(customRoutines, stock)
    .map((kind) => ({ kind, steps: buildRoutine(stock, kind) }))
    .filter((s) => s.steps.length > 0);

  // 重ねる順に意味があるのは区分の中なので、区分ごとに見る
  const conflicts = sections.flatMap((s) => findConflicts(s.steps));
  const hasRoutine = sections.length > 0;
  const hasCleanser = sections.some((s) => s.steps.some((st) => isCleanser(st.item)));
  const hasPrescription = sections.some((s) => s.steps.some((st) => st.item.isPrescription));

  /**
   * ステップごとの一言をAIに書いてもらう（順番はルールが決めている）。
   *
   * 生成結果は在庫と肌質設定の署名つきでキャッシュし、顔ぶれが変わるまで使い回す。
   * 服薬記録で残量が減っても署名は変わらないので、開くたびに呼ぶことにはならない。
   * 失敗しても画面はルールの説明だけで成立するため、エラーは出さずに黙って諦める。
   */
  useEffect(() => {
    if (!loaded || !hasRoutine) return;

    const signature = routineSignature(stock, profile);
    const cached = loadRoutineAdvice(signature);
    if (cached) {
      setAdvice(cached);
      return;
    }

    let aborted = false;
    setAdvising(true);
    fetch('/api/routine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock, profile }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<RoutineAdviceResponse>) : null))
      .then((body) => {
        if (aborted || !body?.advice) return;
        setAdvice(body.advice);
        saveRoutineAdvice(signature, body.advice);
      })
      .catch(() => {
        /* 解説が無くてもルーティンは読める */
      })
      .finally(() => {
        if (!aborted) setAdvising(false);
      });

    return () => {
      aborted = true;
    };
  }, [loaded, hasRoutine, stock, profile]);

  const tips = new Map((advice?.steps ?? []).map((s) => [s.item_id, s.tip]));

  const doneCount = meds.reduce(
    (n, m) => n + m.dose!.times.filter((t) => log.taken.includes(doseKey(m.id, t))).length,
    0,
  );
  const totalCount = meds.reduce((n, m) => n + m.dose!.times.length, 0);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="px-1">
        <p className="text-[12.5px] font-semibold tracking-[0.12em] text-faint">TODAY</p>
        <h1 className="mt-2 text-[29px] font-bold leading-tight tracking-tight text-ink">
          今日のルーティン
        </h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          家にあるものから、使う順番を組み立てています
        </p>
      </header>

      <Link
        href="/profile"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-e1 transition-transform active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#be185d]/8 text-[#be185d]">
          <Sparkles size={16} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">肌質・頭皮の設定</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-faint">
            {profile.skin || profile.scalp || profile.note
              ? [
                  profile.skin && `肌: ${profile.skin}`,
                  profile.scalp && `頭皮: ${profile.scalp}`,
                  profile.note && 'メモあり',
                ]
                  .filter(Boolean)
                  .join(' / ')
              : '洗浄力が合っているかを判定に反映します'}
          </span>
        </span>
        <ChevronRight size={17} className="shrink-0 text-faint" />
      </Link>

      {/* AIによる全体への一言。順番はルールが決めており、ここは言葉だけ */}
      {hasRoutine && (advising || advice?.overall) && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-e1">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.08em] text-faint">
            <Sparkles size={13} strokeWidth={2.2} />
            今日の組み合わせについて
          </p>
          {advising ? (
            <div className="mt-3 space-y-2" aria-label="読み込み中">
              <span className="block h-3 w-full animate-pulse rounded bg-surface-sunken" />
              <span className="block h-3 w-4/5 animate-pulse rounded bg-surface-sunken" />
            </div>
          ) : (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{advice?.overall}</p>
          )}
        </section>
      )}

      {/* 服薬。1件も設定がないと何の画面か分からないため、空でも見出しと導線は出す */}
      {meds.length === 0 && (
        <section className="mt-9">
          <SectionHeader title="今日のお薬" />
          <Link
            href="/stock/new"
            className="mt-2.5 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-4 transition-transform active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">
                飲むタイミングを設定する
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-faint">
                ストックに朝・昼・夜を設定すると、ここに並んで記録を付けられます
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-faint" />
          </Link>
        </section>
      )}

      {meds.length > 0 && (
        <section className="mt-9">
          <SectionHeader
            title="今日のお薬"
            right={<ProgressRing done={doneCount} total={totalCount} />}
          />

          <ul className="stagger mt-2.5 space-y-2">
            {meds.map((item, idx) => (
              <li
                key={item.id}
                style={{ '--i': idx } as React.CSSProperties}
                className="rounded-2xl border border-line bg-surface p-4 shadow-e1"
              >
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 text-[15px] font-semibold leading-snug text-ink">
                    {item.name}
                  </h3>
                  {item.isPrescription && (
                    <span className="mt-0.5 shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">
                      処方
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] tabular-nums text-faint">
                  1回{item.dose!.perTime}
                  {item.remaining?.unit ?? '錠'}
                  {item.remaining && ` ／ 残${item.remaining.count}${item.remaining.unit}`}
                </p>

                <div className="mt-3 flex gap-2">
                  {TIMES.filter((t) => item.dose!.times.includes(t)).map((t) => {
                    const taken = log.taken.includes(doseKey(item.id, t));
                    return (
                      <button
                        key={t}
                        onClick={() => onToggle(item, t)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.97] ${
                          taken
                            ? 'bg-brand text-white shadow-e1'
                            : 'border border-line bg-surface text-muted'
                        }`}
                      >
                        {taken && <Check size={14} strokeWidth={3} />}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <DoseHistory meds={meds} history={history} />
        </section>
      )}

      {sections.map(({ kind, steps }) => (
        <RoutineSection
          key={kind}
          title={routineTitle(kind)}
          caption={routineCaption(kind)}
          steps={steps}
          profile={profile}
          tips={tips}
          editing={reordering === kind}
          onEdit={() => setReordering(reordering === kind ? null : kind)}
          onMove={(from, to) => onMove(steps, from, to)}
          onReset={() => onResetOrder(kind)}
        />
      ))}

      {/* 洗浄基剤 × 肌質（企画書 §6-13）。未設定なら設定へ誘導する */}
      {hasCleanser && !profile.skin && !profile.scalp && <ProfilePrompt />}

      {/* 成分バッティング警告 */}
      {conflicts.length > 0 && (
        <section className="mt-9">
          <SectionHeader title="重ねるときの注意" />
          <ul className="mt-2.5 space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-amber-50 p-4">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" strokeWidth={2.2} />
                <div>
                  <p className="text-[13.5px] font-semibold text-amber-900">
                    {c.ingredients[0]} × {c.ingredients[1]}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-amber-800">{c.detail}</p>
                  <p className="mt-1.5 text-[12px] text-amber-700/90">
                    {c.items[0]} ／ {c.items[1]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {customRoutines.length > 0 && (
        <RoutineManager
          routines={customRoutines}
          stock={stock}
          onRemove={onRemoveRoutine}
        />
      )}

      {hasPrescription && (
        <p className="mt-9 px-1 text-[11.5px] leading-relaxed text-faint">
          処方薬の塗る順番や間隔について指示を受けている場合は、医師・薬剤師の指示が優先されます。
          ここに表示しているのは剤形にもとづく一般的な目安です。
        </p>
      )}

      <BottomNav />
    </main>
  );
}

/** 服薬の進捗。数字だけよりも達成感が出る */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  const ratio = total === 0 ? 0 : done / total;

  return (
    <span className="relative flex h-10 w-10 items-center justify-center">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-surface-sunken" />
        {ratio > 0 && (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(c * ratio).toFixed(2)} ${c.toFixed(2)}`}
            className="stroke-brand transition-[stroke-dasharray] duration-500 ease-out"
          />
        )}
      </svg>
      <span className="absolute text-[10.5px] font-bold tabular-nums text-ink">
        {done}/{total}
      </span>
    </span>
  );
}

/**
 * 直近7日の服薬状況 — Issue #17
 * 記録のない日と飲み忘れを区別する。
 */
function DoseHistory({ meds, history }: { meds: StockItem[]; history: DoseLog[] }) {
  if (meds.length === 0) return null;

  const perDay = meds.reduce((n, m) => n + m.dose!.times.length, 0);
  const label = (d: string) => ['日', '月', '火', '水', '木', '金', '土'][new Date(d).getDay()];

  return (
    <div className="mt-2 rounded-2xl border border-line bg-surface p-4 shadow-e1">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
        この1週間
      </p>
      <ol className="mt-3.5 flex justify-between gap-1">
        {history.map((h, i) => {
          const done = h.taken.length;
          const isToday = i === history.length - 1;
          const full = perDay > 0 && done >= perDay;
          const some = done > 0;
          return (
            <li key={h.date} className="flex flex-1 flex-col items-center gap-2">
              <span
                className={`text-[10.5px] ${isToday ? 'font-bold text-ink' : 'text-faint'}`}
              >
                {label(h.date)}
              </span>
              <span
                title={`${h.date}：${done}/${perDay}`}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  full
                    ? 'bg-brand text-white shadow-e1'
                    : some
                      ? 'bg-brand/35 text-white'
                      : 'border border-dashed border-line-strong'
                }`}
              >
                {full && <Check size={13} strokeWidth={3} />}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3.5 text-[11.5px] leading-relaxed text-faint">
        すべて記録済み ／ 一部のみ ／ 記録なし
      </p>
    </div>
  );
}

function RoutineSection({
  title,
  caption,
  steps,
  profile,
  tips,
  editing,
  onEdit,
  onMove,
  onReset,
}: {
  title: string;
  caption: string;
  steps: RoutineStep[];
  profile: Profile;
  /** AIが書いたステップごとの一言。item id で引く */
  tips: Map<string, string>;
  editing: boolean;
  onEdit: () => void;
  onMove: (from: number, to: number) => void;
  onReset: () => void;
}) {
  if (steps.length === 0) return null;

  const custom = isReordered(steps);

  return (
    <section className="mt-9">
      <SectionHeader
        title={title}
        caption={
          custom
            ? '自分で並べた順です。各ステップの説明は剤形にもとづく一般的な目安です'
            : caption
        }
        right={
          steps.length > 1 && (
            <button
              onClick={onEdit}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                editing ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'
              }`}
            >
              {editing ? '完了' : '並べ替え'}
            </button>
          )
        }
      />

      {editing && custom && (
        <button
          onClick={onReset}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-[12.5px] font-medium text-muted transition-transform active:scale-[0.99]"
        >
          <RotateCcw size={13} strokeWidth={2.2} />
          剤形どおりの順に戻す
        </button>
      )}

      <ol className="stagger mt-3.5">
        {steps.map((s, idx) => {
          const cat = categoryStyle(s.item.category);
          const Icon = cat.icon;
          const match = matchCleanser(s.item, profile);
          const tip = tips.get(s.item.id)?.trim();
          const last = idx === steps.length - 1;

          return (
            <li
              key={s.item.id}
              style={{ '--i': idx } as React.CSSProperties}
              className="flex gap-3.5"
            >
              {/* 番号と縦線 */}
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12.5px] font-bold tabular-nums text-white shadow-e1">
                  {s.order}
                </span>
                {!last && (
                  <span className="w-px flex-1 bg-gradient-to-b from-line-strong to-line" />
                )}
              </div>

              <div className={`min-w-0 flex-1 ${last ? 'pb-1' : 'pb-6'}`}>
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cat.bg} ${cat.text}`}
                  >
                    <Icon size={14} strokeWidth={2.1} />
                  </span>
                  <h3 className="flex-1 text-[15px] font-semibold leading-snug text-ink">
                    {s.item.name}
                  </h3>
                  {s.item.isPrescription && (
                    <span className="mt-0.5 shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">
                      処方
                    </span>
                  )}
                </div>

                <p className="mt-1 pl-9 text-[12px] text-faint">{s.item.form}</p>
                {s.note && (
                  <p className="mt-1.5 pl-9 text-[13px] leading-relaxed text-muted">{s.note}</p>
                )}
                {editing && (
                  <div className="mt-2 flex gap-1.5 pl-9">
                    <button
                      onClick={() => onMove(idx, idx - 1)}
                      disabled={idx === 0}
                      aria-label={`${s.item.name} を上へ`}
                      className="flex h-8 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-transform active:scale-95 disabled:opacity-30"
                    >
                      <ArrowUp size={15} strokeWidth={2.2} />
                    </button>
                    <button
                      onClick={() => onMove(idx, idx + 1)}
                      disabled={last}
                      aria-label={`${s.item.name} を下へ`}
                      className="flex h-8 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-transform active:scale-95 disabled:opacity-30"
                    >
                      <ArrowDown size={15} strokeWidth={2.2} />
                    </button>
                  </div>
                )}
                {tip && (
                  <p className="mt-1.5 flex gap-1.5 pl-9 text-[13px] leading-relaxed text-ink/80">
                    <Sparkles size={13} strokeWidth={2.2} className="mt-[3px] shrink-0 text-[#be185d]" />
                    <span>{tip}</span>
                  </p>
                )}
                {match && (
                  <div className="mt-2.5 pl-9">
                    <CleanserMatchRow match={match} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * 自分で作ったルーティンの管理 — カテゴリと同じ流儀（app/page.tsx）
 *
 * 作るのは在庫の登録画面から。ここでは消すことだけができる。
 * **中身がある区分を消すときは、移動先を選ばせる。** 選ばなければルーティンから
 * 外れるだけで、在庫そのものは消えない。
 */
function RoutineManager({
  routines,
  stock,
  onRemove,
}: {
  routines: string[];
  stock: StockItem[];
  onRemove: (name: string, moveTo?: RoutineKind) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<RoutineKind | ''>('');

  const movable: RoutineKind[] = removing
    ? orderedRoutines(routines, stock).filter((k) => k !== removing)
    : [];

  return (
    <section className="mt-9">
      <SectionHeader title="自分で作ったルーティン" />

      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {routines.map((name) => {
          const used = countInRoutine(stock, name);
          return (
            <li
              key={name}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-muted"
            >
              {name}
              {used > 0 && (
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] tabular-nums text-faint">
                  {used}件
                </span>
              )}
              <button
                onClick={() => {
                  setRemoving(removing === name ? null : name);
                  setMoveTo('');
                }}
                aria-label={`${name} を削除`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-faint transition-transform active:scale-90"
              >
                <X size={13} strokeWidth={2.6} />
              </button>
            </li>
          );
        })}
      </ul>

      {removing && (
        <div className="mt-2.5 rounded-xl bg-red-50 p-3">
          <p className="text-[12.5px] font-semibold text-red-700">
            「{removing}」を削除します
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-600">
            中の
            <span className="tabular-nums"> {countInRoutine(stock, removing)} </span>
            件は消えません。移す先を選ばなければ、ルーティンから外れるだけです。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => setMoveTo('')}
              className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                moveTo === '' ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'
              }`}
            >
              どこにも入れない
            </button>
            {movable.map((m) => (
              <button
                key={m}
                onClick={() => setMoveTo(m)}
                className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  moveTo === m ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'
                }`}
              >
                {routineChipLabel(m)}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => setRemoving(null)}
              className="flex-1 rounded-xl bg-surface py-2.5 text-[13px] font-medium text-muted transition-transform active:scale-95"
            >
              やめる
            </button>
            <button
              onClick={() => {
                onRemove(removing, moveTo || undefined);
                setRemoving(null);
              }}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-95"
            >
              削除する
            </button>
          </div>
        </div>
      )}

      <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-faint">
        ルーティンはストックの登録・編集画面から作れます。
        もとからある2つは消せません。
      </p>
    </section>
  );
}
