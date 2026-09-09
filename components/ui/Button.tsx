'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-e2 active:bg-brand-soft disabled:opacity-30 disabled:shadow-none',
  secondary: 'border border-line bg-surface text-ink shadow-e1 active:bg-surface-sunken',
  ghost: 'text-muted active:text-ink',
};

const BASE =
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.985]';

export function Button({
  children,
  variant = 'primary',
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  variant?: Variant;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${BASE} ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {children}
    </Link>
  );
}
