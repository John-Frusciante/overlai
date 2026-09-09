import Link from 'next/link';
import { Droplets } from 'lucide-react';
import type { CleanserMatch } from '@/lib/types';

/** 洗浄基剤と肌質の相性表示 — 企画書 §6-13 */
export function CleanserMatchRow({ match }: { match: CleanserMatch }) {
  const tone =
    match.level === 'caution'
      ? 'bg-amber-50 text-amber-900'
      : match.level === 'good'
        ? 'bg-emerald-50 text-emerald-900'
        : 'bg-surface-sunken text-muted';

  return (
    <div className={`flex gap-3 rounded-2xl px-4 py-3.5 ${tone}`}>
      <Droplets size={16} className="mt-0.5 shrink-0 opacity-70" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">
          {match.base}
          {match.ingredient && (
            <span className="ml-1.5 font-normal opacity-70">{match.ingredient}</span>
          )}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed opacity-90">{match.message}</p>
      </div>
    </div>
  );
}

/** 肌質未設定のときの誘導 */
export function ProfilePrompt() {
  return (
    <Link
      href="/profile"
      className="mt-3 block rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-4 text-center text-[13.5px] font-medium text-muted transition-transform active:scale-[0.99]"
    >
      肌質・頭皮の状態を設定すると、洗浄力が合っているか確認できます
    </Link>
  );
}
