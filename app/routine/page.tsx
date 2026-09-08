'use client';

import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { buildRoutine, findConflicts } from '@/lib/routine';
import { doseKey, loadDoseLog, loadStock, toggleDose, todayKey } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { DoseLog, DoseTime, RoutineStep, StockItem } from '@/lib/types';

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

  useEffect(() => {
    setStock(loadStock());
    setLog(loadDoseLog());
  }, []);

  const onToggle = useCallback((item: StockItem, time: DoseTime) => {
    const { log: nextLog, stock: nextStock } = toggleDose(item, time);
    setLog(nextLog);
    setStock(nextStock);
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
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-14">
      <header className="px-1">
        <p className="text-[13px] font-medium tracking-wide text-zinc-400">Overlai</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight text-zinc-900">今日のルーティン</h1>
        <p className="mt-1.5 text-[13.5px] text-zinc-500">
          家にあるものから、使う順番を組み立てています
        </p>
      </header>

      {/* 服薬 */}
      {meds.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-xs font-semibold tracking-wide text-zinc-500">今日のお薬</h2>
            <span className="text-[12px] tabular-nums text-zinc-400">
              {doneCount}/{totalCount}
            </span>
          </div>

          <ul className="mt-2 space-y-2">
            {meds.map((item) => (
              <li key={item.id} className="rounded-xl border border-zinc-200/80 bg-white p-4">
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                    {item.name}
                  </h3>
                  {item.isPrescription && (
                    <span className="mt-0.5 shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      処方
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-zinc-500">
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
                        className={`flex-1 rounded-lg py-2.5 text-[14px] font-semibold transition-colors ${
                          taken
                            ? 'bg-zinc-900 text-white'
                            : 'border border-zinc-300 bg-white text-zinc-600 active:bg-zinc-50'
                        }`}
                      >
                        {taken ? `${t} ✓` : t}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RoutineSection
        title="お風呂で洗う順番"
        caption="トリートメントの流し残しが体に付かない順に並べています"
        steps={inbath}
      />

      <RoutineSection
        title="お風呂上がりに塗る順番"
        caption="水分の多いものから、油分で蓋をするものへ並べています"
        steps={outbath}
      />

      {/* 成分バッティング警告 */}
      {conflicts.length > 0 && (
        <section className="mt-8">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-zinc-500">
            重ねるときの注意
          </h2>
          <ul className="mt-2 space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="rounded-xl bg-amber-50 p-4">
                <p className="text-[14px] font-semibold text-amber-900">
                  {c.ingredients[0]} × {c.ingredients[1]}
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-amber-800">{c.detail}</p>
                <p className="mt-1.5 text-[12.5px] text-amber-700">
                  {c.items[0]} ／ {c.items[1]}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outbath.some((s) => s.item.isPrescription) && (
        <p className="mt-8 px-1 text-[12px] leading-relaxed text-zinc-400">
          処方薬の塗る順番や間隔について指示を受けている場合は、医師・薬剤師の指示が優先されます。
          ここに表示しているのは剤形にもとづく一般的な目安です。
        </p>
      )}

      <BottomNav />
    </main>
  );
}

function RoutineSection({
  title,
  caption,
  steps,
}: {
  title: string;
  caption: string;
  steps: RoutineStep[];
}) {
  if (steps.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-zinc-500">{title}</h2>
      <p className="mt-1 px-1 text-[12.5px] text-zinc-400">{caption}</p>

      <ol className="mt-3">
        {steps.map((s, idx) => (
          <li key={s.item.id} className="flex gap-3">
            {/* 番号と縦線 */}
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[12.5px] font-bold tabular-nums text-white">
                {s.order}
              </span>
              {idx < steps.length - 1 && <span className="w-px flex-1 bg-zinc-200" />}
            </div>

            <div className="flex-1 pb-5">
              <div className="flex items-start gap-2">
                <h3 className="flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                  {s.item.name}
                </h3>
                {s.item.isPrescription && (
                  <span className="mt-0.5 shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                    処方
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] text-zinc-400">{s.item.form}</p>
              {s.note && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{s.note}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
