'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight, Sparkles } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CleanserMatchRow, ProfilePrompt } from '@/components/CleanserMatchCard';
import { buildRoutine, findConflicts } from '@/lib/routine';
import { matchCleanser } from '@/lib/cleanser';
import {
  doseKey,
  loadDoseLog,
  loadProfile,
  loadRecentDoseLogs,
  loadStock,
  toggleDose,
  todayKey,
} from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import { CATEGORY_STYLE, FALLBACK_ICON } from '@/lib/ui';
import type { DoseLog, DoseTime, Profile, RoutineStep, StockItem } from '@/lib/types';

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

  useEffect(() => {
    setStock(loadStock());
    setLog(loadDoseLog());
    setProfile(loadProfile());
    setHistory(loadRecentDoseLogs(7));
  }, []);

  const onToggle = useCallback((item: StockItem, time: DoseTime) => {
    const { log: nextLog, stock: nextStock } = toggleDose(item, time);
    setLog(nextLog);
    setStock(nextStock);
    setHistory(loadRecentDoseLogs(7));
  }, []);

  const meds = stock.filter((i) => i.dose && i.dose.times.length > 0);
  const inbath = buildRoutine(stock, 'inbath');
  const outbath = buildRoutine(stock, 'outbath');
  const conflicts = findConflicts(outbath);

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
            {profile.skin || profile.scalp
              ? [profile.skin && `肌: ${profile.skin}`, profile.scalp && `頭皮: ${profile.scalp}`]
                  .filter(Boolean)
                  .join(' / ')
              : '洗浄力が合っているかを判定に反映します'}
          </span>
        </span>
        <ChevronRight size={17} className="shrink-0 text-faint" />
      </Link>

      {/* 服薬 */}
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
                  1回{item.dose!.perTime}錠
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

      <RoutineSection
        title="お風呂で洗う順番"
        caption="トリートメントの流し残しが体に付かない順に並べています"
        steps={inbath}
        profile={profile}
      />

      {/* 洗浄基剤 × 肌質（企画書 §6-13）。未設定なら設定へ誘導する */}
      {inbath.length > 0 && !profile.skin && !profile.scalp && <ProfilePrompt />}

      <RoutineSection
        title="お風呂上がりに塗る順番"
        caption="水分の多いものから、油分で蓋をするものへ並べています"
        steps={outbath}
        profile={profile}
      />

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

      {outbath.some((s) => s.item.isPrescription) && (
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
}: {
  title: string;
  caption: string;
  steps: RoutineStep[];
  profile: Profile;
}) {
  if (steps.length === 0) return null;

  return (
    <section className="mt-9">
      <SectionHeader title={title} caption={caption} />

      <ol className="stagger mt-3.5">
        {steps.map((s, idx) => {
          const cat = CATEGORY_STYLE[s.item.category];
          const Icon = cat?.icon ?? FALLBACK_ICON;
          const match = matchCleanser(s.item, profile);
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
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cat?.bg} ${cat?.text}`}
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
