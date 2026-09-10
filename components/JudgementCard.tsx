'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Stethoscope, X } from 'lucide-react';
import { matchCleanser } from '@/lib/cleanser';
import { toItemForm } from '@/lib/mapping';
import { CleanserMatchRow } from '@/components/CleanserMatchCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { categoryStyle, SIGNAL_ORDER, SIGNAL_STYLE, overlaySymbolPath } from '@/lib/ui';
import type { AnalyzeResponse, Profile, StockItem } from '@/lib/types';

/**
 * 判定カード — 設計仕様書 §9.4
 *
 * デモ映像の山場。3秒で色が判別できる視認性を最優先にする。
 * 構造は「グラデーションのヒーロー ＋ せり上がる白いシート」。
 * シグナルは絵文字ではなく、重なる2つの角丸矩形（プロダクト名 Overlay の由来）で表す。
 *
 * **画面全体が1つの巻物としてスクロールする。** 以前はヒーローを固定し、白いシートだけを
 * スクロールさせていたが、上下が固定されたぶん読める幅が画面の半分ほどしか残らず、
 * 根拠を開いたときに細い窓から覗くことになっていた。
 *
 * 色は判定そのものなので、ヒーローが流れたあとは細いヘッダーに残す。
 * これは装飾ではなく、いま何色の話を読んでいるかを見失わせないための帯である。
 */
export function JudgementCard({
  result,
  stock,
  profile = {},
  onClose,
}: {
  result: AnalyzeResponse;
  stock: StockItem[];
  profile?: Profile;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  /** ヒーローが画面から出たか。出たら細いヘッダーに切り替える */
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroEndRef = useRef<HTMLDivElement>(null);
  const reasonsRef = useRef<HTMLElement>(null);

  const { extraction, judgement } = result;
  const style = SIGNAL_STYLE[judgement.signal];
  const symbol = overlaySymbolPath();
  const matched = stock.filter((s) => judgement.matched_item_ids.includes(s.id));

  // 洗浄料なら、肌質・頭皮との相性をルールベースで補足する（企画書 §6-13）
  const cleanser = matchCleanser(
    { form: toItemForm(extraction.form), ingredients: extraction.ingredients },
    profile,
  );

  // ヒーローの末尾を見張る。スクロール量ではなく交差で見るので、
  // 端末ごとの高さの違いに左右されない。
  // 画面より背の高いヒーロー（横向きなど）では末尾が最初から画面外にあるため、
  // 「上に抜けたか」まで見て、まだ届いていないだけの状態と区別する
  useEffect(() => {
    const sentinel = heroEndRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { root: scrollRef.current },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  /**
   * 根拠の開閉。**開いたら、その見出しが画面の先頭に来るまで送る。**
   * 「根拠を見る」を押した人が見たいのは根拠であって、その上にある成分表ではない。
   */
  const toggleReasons = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      requestAnimationFrame(() =>
        reasonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  };

  const gradient = `linear-gradient(142deg, ${style.base} 0%, ${style.deep} 100%)`;

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-surface"
    >
      {/* 細いヘッダー — ヒーローが流れたら、色と見出しだけを残す */}
      <div
        aria-hidden={!scrolled}
        className={`fixed inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pb-3 pt-safe-bar text-white transition-opacity duration-200 ${
          scrolled ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ background: gradient }}
      >
        <div className="flex shrink-0 items-center gap-1" aria-hidden>
          {SIGNAL_ORDER.map((sig) => (
            <span
              key={sig}
              className={`h-1.5 rounded-full bg-white transition-all duration-300 ${
                sig === judgement.signal ? 'w-5 opacity-100' : 'w-1.5 opacity-35'
              }`}
            />
          ))}
        </div>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {judgement.headline}
        </span>
        <button
          onClick={onClose}
          aria-label="閉じる"
          tabIndex={scrolled ? 0 : -1}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-transform active:scale-90"
        >
          <X size={17} strokeWidth={2.2} />
        </button>
      </div>

      {/* ヒーロー */}
      <div
        className="relative px-5 pt-safe pb-16 text-white"
        style={{ background: gradient }}
      >
        <button
          onClick={onClose}
          aria-label="閉じる"
          tabIndex={scrolled ? -1 : 0}
          className="absolute right-4 top-safe flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-transform active:scale-90"
        >
          <X size={17} strokeWidth={2.2} />
        </button>

        <div className="animate-scale-in mt-3 flex items-center gap-4">
          <svg viewBox="0 0 90 90" className="h-[62px] w-[62px]" aria-hidden>
            <path d={symbol.a} fill="#fff" fillOpacity="0.5" />
            <path d={symbol.b} fill="#fff" fillOpacity="0.5" />
          </svg>

          {/* 判定が3段階であること自体を示す */}
          <div className="flex flex-col gap-1.5" aria-hidden>
            {SIGNAL_ORDER.map((sig) => (
              <span
                key={sig}
                className={`h-2 rounded-full bg-white transition-all duration-300 ${
                  sig === judgement.signal ? 'w-7 opacity-100' : 'w-2 opacity-35'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="animate-fade-up">
          <h1 className="mt-7 text-[2.05rem] font-bold leading-[1.15] tracking-tight">
            {judgement.headline}
          </h1>
          <p className="mt-3.5 max-w-[34ch] text-[14.5px] leading-relaxed text-white/85">
            {judgement.summary}
          </p>
        </div>
      </div>

      {/* ヒーローが画面から出たかを見張る */}
      <div ref={heroEndRef} aria-hidden className="h-px" />

      {/* せり上がる白いシート */}
      <div className="animate-sheet-up relative -mt-7 rounded-t-[26px] bg-surface px-5 pb-36 pt-7 shadow-e4">
        {/* 検出成分 */}
        <section>
          <SectionHeader title="この商品から検出された成分" />
          {extraction.product_name && (
            <p className="mt-2 px-1 text-[16px] font-semibold leading-snug text-ink">
              {extraction.product_name}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5 px-1">
            {extraction.ingredients.slice(0, 3).map((ing, i) => (
              <span
                key={ing}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  i === 0 ? style.chip : 'bg-surface-sunken text-muted'
                }`}
              >
                {ing}
              </span>
            ))}
            {extraction.ingredients.length > 3 && (
              <span className="rounded-full px-3 py-1.5 text-[13px] text-faint">
                ほか{extraction.ingredients.length - 3}件
              </span>
            )}
          </div>
          {extraction.confidence === 'low' && (
            <p className="mx-1 mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-800">
              読み取り精度が低い可能性があります。判定は参考程度にご覧ください。
            </p>
          )}
        </section>

        {/* 洗浄基剤 × 肌質 */}
        {cleanser && (
          <section className="mt-8">
            <SectionHeader title="洗浄力とあなたの状態" />
            <div className="mt-2.5">
              <CleanserMatchRow match={cleanser} />
            </div>
          </section>
        )}

        {/* 該当する自宅アイテム */}
        {matched.length > 0 && (
          <section className="mt-8">
            <SectionHeader title="あなたの家にあるもの" count={matched.length} />
            <ul className="stagger mt-2.5 space-y-2">
              {matched.map((item, i) => {
                const cat = categoryStyle(item.category);
                const Icon = cat.icon;
                return (
                  <li
                    key={item.id}
                    style={{ '--i': i } as React.CSSProperties}
                    className={`flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-e2 ring-1 ${style.ring}`}
                  >
                    {Icon && (
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bg} ${cat.text}`}
                      >
                        <Icon size={17} strokeWidth={2} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <span className="flex-1 text-[15px] font-semibold leading-snug text-ink">
                          {item.name}
                        </span>
                        {item.isPrescription && (
                          <span className="mt-0.5 shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">
                            処方
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                        {item.ingredients.join('、')}
                      </p>
                      <p className="mt-0.5 text-[12.5px] tabular-nums text-faint">
                        {item.remaining
                          ? `残${item.remaining.count}${item.remaining.unit}`
                          : item.status}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 根拠を見る */}
        {judgement.reasons.length > 0 && (
          <section ref={reasonsRef} className="mt-8 scroll-mt-bar">
            <button
              onClick={toggleReasons}
              aria-expanded={open}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-4 text-left shadow-e1 transition-transform active:scale-[0.99]"
            >
              <span className="text-[15px] font-semibold text-ink">根拠を見る</span>
              <ChevronDown
                size={18}
                className={`text-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
              />
            </button>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <ul className="mt-2 space-y-2.5 overflow-hidden">
                {judgement.reasons.map((r, i) => (
                  <li key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-e1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-brand px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">
                        {r.type}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${style.chip}`}
                      >
                        {r.ingredient}
                      </span>
                    </div>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-ink/85">{r.detail}</p>
                    <p className="mt-2 text-[12.5px] text-faint">該当：{r.related_item}</p>
                    {/* 一次情報への入り口。出典はAIに書かせず、サーバー側で付ける（lib/verify.ts） */}
                    {r.evidence && (
                      <a
                        href={r.evidence.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-start gap-1.5 text-[12px] font-medium leading-relaxed text-brand underline underline-offset-2"
                      >
                        <ExternalLink size={12} strokeWidth={2.2} className="mt-[3px] shrink-0" />
                        <span>{r.evidence.label}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {/* ここで確かめられることと、確かめられないことを書き分ける */}
              <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-faint">
                挙げている成分は、読み取った成分表示か登録済みのストックに実際にあったものだけです。
                書かれている内容そのものの妥当性は、リンク先の添付文書でお確かめください。
              </p>
            </div>
          </section>
        )}

        {/* 免責 — §12.2 */}
        <p className="mt-9 px-1 text-[11.5px] leading-relaxed text-faint">
          本アプリは一般的な成分情報を提示するものであり、診断・治療の判断を行うものではありません。
          実際の使用可否は薬剤師・医師にご相談ください。
        </p>
        <p className="mt-2 px-1 text-[11px] tabular-nums text-faint/70">
          判定にかかった時間 {(result.elapsed_ms / 1000).toFixed(1)}秒
        </p>
      </div>

      {/* 相談導線 — 全判定色で常設（FR-10） */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/92 px-5 pb-safe pt-3 backdrop-blur-xl">
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-e2 transition-transform active:scale-[0.985] active:bg-brand-soft">
          <Stethoscope size={17} strokeWidth={2} />
          薬剤師・皮膚科に相談する
        </button>
      </div>
    </div>
  );
}
