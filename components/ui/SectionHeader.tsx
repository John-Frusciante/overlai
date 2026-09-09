import type { ReactNode } from 'react';

/** セクション見出し。3画面で重複していた形を共通化する */
export function SectionHeader({
  title,
  count,
  caption,
  right,
}: {
  title: ReactNode;
  count?: number;
  caption?: string;
  right?: ReactNode;
}) {
  return (
    <div className="px-1">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-baseline gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
          {title}
          {count !== undefined && (
            <span className="font-normal tabular-nums text-faint/70">{count}</span>
          )}
        </h2>
        {right}
      </div>
      {caption && <p className="mt-1 text-[12.5px] text-faint">{caption}</p>}
    </div>
  );
}
