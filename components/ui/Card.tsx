import type { ReactNode } from 'react';

/** サーフェス。elevation で階層を表す */
export function Card({
  children,
  elevation = 1,
  className = '',
}: {
  children: ReactNode;
  elevation?: 1 | 2 | 3;
  className?: string;
}) {
  const shadow = elevation === 3 ? 'shadow-e3' : elevation === 2 ? 'shadow-e2' : 'shadow-e1';
  return (
    <div className={`rounded-2xl border border-line bg-surface ${shadow} ${className}`}>
      {children}
    </div>
  );
}
