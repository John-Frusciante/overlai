'use client';

import { useRouter } from 'next/navigation';
import { useStoredState } from '@/lib/client';
import { loadProfile, saveProfile } from '@/lib/storage';
import { MAX_PROFILE_NOTE } from '@/lib/request';
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
  const [profile, setProfile] = useStoredState<Profile>(loadProfile, {});

  const update = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">肌質の設定</h1>
        <button
          onClick={() => router.back()}
          className="text-[14px] font-medium text-muted active:text-ink"
        >
          完了
        </button>
      </header>

      <p className="mt-3 px-1 text-[13.5px] leading-relaxed text-muted">
        シャンプーや洗顔料の洗浄力が、いまの状態に合っているかを見るために使います。
        設定は任意です。
      </p>

      <section className="mt-8">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">肌の状態</h2>
        <p className="mt-1 px-1 text-[12.5px] text-faint">洗顔料・ボディソープの判定に使います</p>
        <Options
          options={SKINS}
          value={profile.skin}
          onChange={(v) => update({ skin: v })}
        />
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">頭皮の状態</h2>
        <p className="mt-1 px-1 text-[12.5px] text-faint">シャンプーの判定に使います</p>
        <Options
          options={SCALPS}
          value={profile.scalp}
          onChange={(v) => update({ scalp: v })}
        />
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted">気になっていること</h2>
        <p className="mt-1 px-1 text-[12.5px] leading-relaxed text-faint">
          選択肢に当てはまらないことを、自分の言葉で書けます。
          今日のルーティンに出る一言に反映されます。
        </p>
        <textarea
          value={profile.note ?? ''}
          onChange={(e) => update({ note: e.target.value })}
          rows={4}
          maxLength={MAX_PROFILE_NOTE}
          placeholder="例：冬だけ頬がかさつきます。夜は時間がないので手早く済ませたいです。"
          className="mt-3 w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
        />
        <p className="mt-1.5 px-1 text-right text-[11.5px] tabular-nums text-faint">
          {(profile.note ?? '').length} / {MAX_PROFILE_NOTE}
        </p>
        <p className="mt-1 px-1 text-[11.5px] leading-relaxed text-faint">
          洗浄力の判定に使うのは上で選んだ肌質・頭皮です。ここに書いた内容は判定の色を変えません。
        </p>
      </section>

      <p className="mt-10 px-1 text-[12px] leading-relaxed text-faint">
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
