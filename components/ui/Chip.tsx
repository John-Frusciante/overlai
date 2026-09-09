import type { ReactNode } from 'react';

type Tone = 'neutral' | 'strong' | 'warn' | 'danger' | 'good';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  strong: 'bg-brand text-white',
  warn: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
  good: 'bg-emerald-50 text-emerald-800',
};

/** 成分タグ・状態バッジ */
export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-medium ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
