'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadProfile, saveProfile } from '@/lib/storage';
import type { Profile, ScalpType, SkinType } from '@/lib/types';

/**
 * 肌質・頭皮の設定 — 洗浄基剤の相性判定（企画書 §6-13）に使う
 *
 * これは自己申告であり診断ではない。画面にも明示する（設計仕様書 §12）。
 */

const SKINS: SkinType[] = ['乾燥', '脂性', '混合', '敏感', '普通'];
const SCALPS: ScalpType[] = ['乾燥', '脂性', 'ふけ・かゆみ', '普通'];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({});

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const update = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">肌質の設定</h1>
        <button
          onClick={() => router.back()}
          className="text-[14px] font-medium text-zinc-500 active:text-zinc-900"
        >
          完了
        </button>
      </header>

      <p className="mt-3 px-1 text-[13.5px] leading-relaxed text-zinc-500">
        シャンプーや洗顔料の洗浄力が、いまの状態に合っているかを見るために使います。
        設定は任意です。
      </p>

      <section className="mt-8">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-zinc-500">肌の状態</h2>
        <p className="mt-1 px-1 text-[12.5px] text-zinc-400">洗顔料・ボディソープの判定に使います</p>
        <Options
          options={SKINS}
          value={profile.skin}
          onChange={(v) => update({ skin: v })}
        />
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-zinc-500">頭皮の状態</h2>
        <p className="mt-1 px-1 text-[12.5px] text-zinc-400">シャンプーの判定に使います</p>
        <Options
          options={SCALPS}
          value={profile.scalp}
          onChange={(v) => update({ scalp: v })}
        />
      </section>

      <p className="mt-10 px-1 text-[12px] leading-relaxed text-zinc-400">
        ここで選ぶのはご自身の感じ方であり、診断ではありません。
        肌トラブルが続く場合は皮膚科にご相談ください。
      </p>
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
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? undefined : o)}
          className={`rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors ${
            value === o
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
