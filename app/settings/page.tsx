'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { CategoryManager } from '@/components/CategoryManager';
import { RoutineManager } from '@/components/RoutineManager';
import {
  loadCustomCategories,
  loadCustomRoutines,
  loadProfile,
  loadStock,
  moveCategory,
  moveRoutine,
  resetStock,
  saveCollapsed,
  saveCustomCategories,
  saveCustomRoutines,
  saveProfile,
} from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { AgeBand, Gender, Profile, RoutineKind, StockItem } from '@/lib/types';

/**
 * 設定 — 一覧の見た目を変えずに済む操作をここへ集約する
 *
 * マイストックの「編集モード」を廃してこの画面に寄せた。編集・削除は各カードに
 * 常設したので、一覧側にモードを持つ理由が無くなったため。
 *
 * 年代・性別は**AIが書く一言の手がかりにだけ使う**。判定（/api/analyze）には渡さない。
 * 🟡🔴の分かれ目は在庫との関係だけで決めており、そこに属性を持ち込むと
 * 「なぜこの色になったか」の説明が変わってしまう（設計仕様書 §7.7）。
 */

const AGES: AgeBand[] = ['10代', '20代', '30代', '40代', '50代', '60代以上'];
const GENDERS: Gender[] = ['女性', '男性', 'その他', '答えない'];

export default function SettingsPage() {
  const router = useRouter();
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  const [profile, setProfile] = useState<Profile>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [routines, setRoutines] = useState<string[]>([]);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setStock(loadStock());
    setProfile(loadProfile());
    setCategories(loadCustomCategories());
    setRoutines(loadCustomRoutines());
  }, []);

  const update = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const onReset = useCallback(() => {
    setStock(resetStock());
    saveCollapsed([]);
    saveCustomCategories([]);
    saveCustomRoutines([]);
    setCategories([]);
    setRoutines([]);
    setResetting(false);
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-24 pt-safe">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">設定</h1>
        <button
          onClick={() => router.back()}
          className="text-[14px] font-medium text-muted active:text-ink"
        >
          完了
        </button>
      </header>

      {/* ── あなたについて ─────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">あなたについて</h2>
        <p className="mt-1 px-1 text-[12.5px] leading-relaxed text-faint">
          今日のルーティンに出る一言の手がかりに使います。どちらも任意です。
        </p>

        <p className="mt-4 px-1 text-[12.5px] font-medium text-muted">年代</p>
        <Options options={AGES} value={profile.age} onChange={(v) => update({ age: v })} />

        <p className="mt-4 px-1 text-[12.5px] font-medium text-muted">性別</p>
        <Options
          options={GENDERS}
          value={profile.gender}
          onChange={(v) => update({ gender: v })}
        />

        <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-faint">
          ここで選んだ内容は、店頭スキャンの判定（🔵🟡🔴）を変えません。
          判定の基準は家にあるものとの関係だけです。
        </p>
      </section>

      {/* ── 肌質・頭皮 ────────────────────────────────────────── */}
      <section className="mt-9">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">肌質・頭皮</h2>
        <Link
          href="/profile"
          className="mt-2.5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-e1 transition-transform active:scale-[0.99]"
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
                : '洗浄料の洗浄力が合っているかの判定に使います'}
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-faint" />
        </Link>
      </section>

      {/* ── 分け方 ────────────────────────────────────────────── */}
      <section className="mt-9 space-y-2.5">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">自分の分け方</h2>
        <CategoryManager
          categories={categories}
          stock={stock}
          onChange={(next) => {
            saveCustomCategories(next);
            setCategories(next);
          }}
          onDelete={(name, moveTo) => {
            if (moveTo) setStock(moveCategory(name, moveTo));
            const next = categories.filter((c) => c !== name);
            saveCustomCategories(next);
            setCategories(next);
          }}
        />
        <RoutineManager
          routines={routines}
          stock={stock}
          onChange={(next) => {
            saveCustomRoutines(next);
            setRoutines(next);
          }}
          onDelete={(name, moveTo?: RoutineKind) => {
            setStock(moveRoutine(name, moveTo));
            const next = routines.filter((r) => r !== name);
            saveCustomRoutines(next);
            setRoutines(next);
          }}
        />
      </section>

      {/* ── データ ────────────────────────────────────────────── */}
      <section className="mt-9">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">データ</h2>
        <p className="mt-1 px-1 text-[12.5px] leading-relaxed text-faint">
          ストックはこの端末の中だけに保存されます。サーバーには送られません。
        </p>

        {resetting ? (
          <div className="mt-2.5 rounded-2xl bg-red-50 p-4">
            <p className="text-[13.5px] font-semibold text-red-700">
              最初の状態に戻しますか？
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-red-600">
              いま入っているストック
              <span className="tabular-nums"> {stock.length} </span>
              件と、自分で作ったカテゴリ・ルーティンが消えて、見本のデータに戻ります。
              元には戻せません。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setResetting(false)}
                className="flex-1 rounded-xl bg-surface py-3 text-[14px] font-medium text-muted transition-transform active:scale-95"
              >
                やめる
              </button>
              <button
                onClick={onReset}
                className="flex-1 rounded-xl bg-red-600 py-3 text-[14px] font-semibold text-white transition-transform active:scale-95"
              >
                戻す
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setResetting(true)}
            className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-e1 transition-transform active:scale-[0.99]"
          >
            <RotateCcw size={16} className="shrink-0 text-muted" strokeWidth={2} />
            <span className="flex-1 text-left text-[14px] font-semibold text-ink">
              見本のデータに戻す
            </span>
            <span className="text-[12.5px] text-faint">{stock.length}件</span>
          </button>
        )}
      </section>

      {/* ── このアプリについて ─────────────────────────────────── */}
      <section className="mt-9">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">このアプリについて</h2>
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-faint">
          Overlai は、家にある薬・化粧品を基準に「買う必要があるか」を確かめるためのアプリです。
          診断や治療の判断を行うものではなく、表示している内容は成分にもとづく一般的な目安です。
          気になる症状が続く場合や、薬の飲み合わせに不安がある場合は、薬剤師・医師にご相談ください。
        </p>
      </section>
    </main>
  );
}

function Options<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? undefined : o)}
          className={`rounded-full px-4 py-2.5 text-[14px] font-medium transition-[transform,background-color] duration-150 active:scale-95 ${
            value === o
              ? 'bg-brand text-white shadow-e1'
              : 'border border-line bg-surface text-muted active:bg-surface-sunken'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
