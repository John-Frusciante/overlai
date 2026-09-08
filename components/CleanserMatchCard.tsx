import Link from 'next/link';
import type { CleanserMatch } from '@/lib/types';

/** 洗浄基剤と肌質の相性表示 — 企画書 §6-13 */
export function CleanserMatchRow({ match }: { match: CleanserMatch }) {
  const tone =
    match.level === 'caution'
      ? 'bg-amber-50 text-amber-800'
      : match.level === 'good'
        ? 'bg-emerald-50 text-emerald-800'
        : 'bg-zinc-100 text-zinc-600';

  return (
    <div className={`rounded-lg px-3 py-2.5 ${tone}`}>
      <p className="text-[12.5px] font-semibold">
        {match.base}
        {match.ingredient && (
          <span className="ml-1.5 font-normal opacity-75">{match.ingredient}</span>
        )}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed">{match.message}</p>
    </div>
  );
}

/** 肌質未設定のときの誘導 */
export function ProfilePrompt() {
  return (
    <Link
      href="/profile"
      className="mt-3 block rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3.5 text-center text-[13.5px] font-medium text-zinc-600 active:bg-zinc-50"
    >
      肌質・頭皮の状態を設定すると、洗浄力が合っているか確認できます
    </Link>
  );
}
