'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toResizedDataUrl } from '@/lib/image';
import { addStock, loadStock, updateStock } from '@/lib/storage';
import { toItemForm, toStockCategory } from '@/lib/mapping';
import type { ApiErrorBody, ExtractionResult, ItemForm, RoutineKind, StockCategory } from '@/lib/types';

/**
 * 在庫の追加・編集 — 企画書 §4 ①「登録は3経路」のうちカメラ読み取りと手入力
 *
 * 「まず全部登録してください」を要求しない設計が鍵なので、
 * 成分の読み取りは任意であり、手入力だけでも登録できる。
 *
 * `?id=` が付いていれば既存アイテムの編集として動く。
 */

const CATEGORIES: StockCategory[] = [
  '処方薬',
  '処方薬(外用)',
  '市販薬・サプリ',
  'スキンケア',
  'ヘアケア',
  'ボディケア',
];

const FORMS: ItemForm[] = [
  '錠剤', 'カプセル', '導入液', '化粧水', '美容液', 'ローション', '乳液',
  'クリーム', '軟膏', 'オイル', 'シャンプー', 'トリートメント', '洗顔', 'ボディソープ', 'その他',
];

export default function NewStockPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockCategory>('スキンケア');
  const [form, setForm] = useState<ItemForm>('化粧水');
  const [ingredients, setIngredients] = useState('');
  const [status, setStatus] = useState('');
  const [openedAt, setOpenedAt] = useState('');
  const [routine, setRoutine] = useState<RoutineKind | ''>('');

  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  /** 編集対象のid。null なら新規追加 */
  const [editId, setEditId] = useState<string | null>(null);

  // 既存アイテムの編集として開かれた場合は値を読み込む
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    const item = loadStock().find((i) => i.id === id);
    if (!item) return;
    setEditId(id);
    setName(item.name);
    setCategory(item.category);
    setForm(item.form);
    setIngredients(item.ingredients.join('、'));
    setStatus(item.status);
    setOpenedAt(item.openedAt ?? '');
    setRoutine(item.routine ?? '');
  }, []);

  const readFromImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setReading(true);
    setReadError('');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: await toResizedDataUrl(file) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        setReadError(body?.error.message ?? '読み取りに失敗しました');
        return;
      }
      const { extraction } = (await res.json()) as { extraction: ExtractionResult };
      if (extraction.product_name) setName(extraction.product_name);
      setCategory(toStockCategory(extraction.category));
      setForm(toItemForm(extraction.form));
      setIngredients(extraction.ingredients.join('、'));
    } catch {
      setReadError('通信に失敗しました');
    } finally {
      setReading(false);
    }
  }, []);

  const save = useCallback(() => {
    if (!name.trim()) return;
    const values = {
      name: name.trim(),
      category,
      form,
      ingredients: ingredients
        .split(/[、,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      status: status.trim() || '使用中',
      isPrescription: category === '処方薬' || category === '処方薬(外用)',
      openedAt: openedAt || undefined,
      routine: routine || undefined,
    };
    if (editId) updateStock(editId, values);
    else addStock(values);
    router.push('/');
  }, [editId, name, category, form, ingredients, status, openedAt, routine, router]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">
          {editId ? 'ストックを編集' : 'ストックを追加'}
        </h1>
        <button
          onClick={() => router.back()}
          className="text-[14px] font-medium text-zinc-500 active:text-zinc-900"
        >
          キャンセル
        </button>
      </header>

      {/* 成分の読み取り */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={reading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white py-5 text-[14.5px] font-semibold text-zinc-700 active:bg-zinc-50 disabled:opacity-50"
      >
        {reading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
            成分を読み取っています…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="6" width="18" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.9" />
              <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.9" />
              <path d="M8.5 6l1.2-2h4.6L15.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
            </svg>
            成分表示を撮って読み取る
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={readFromImage} className="hidden" />
      {readError && <p className="mt-2 px-1 text-[13px] text-red-600">{readError}</p>}
      <p className="mt-2 px-1 text-[12.5px] text-zinc-400">
        読み取らずに手で入力しても登録できます。
      </p>

      {/* フォーム */}
      <div className="mt-7 space-y-5">
        <Field label="商品名">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：しっとり化粧水"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-zinc-900"
          />
        </Field>

        <Field label="カテゴリ">
          <Chips options={CATEGORIES} value={category} onChange={setCategory} />
        </Field>

        <Field label="剤形">
          <select
            value={form}
            onChange={(e) => setForm(e.target.value as ItemForm)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-zinc-900"
          >
            {FORMS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>

        <Field label="成分（読点区切り）">
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={3}
            placeholder="例：グリセリン、BG"
            className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-zinc-900"
          />
        </Field>

        <Field label="状態（任意）">
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="例：残12錠 / 使用中"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-zinc-900"
          />
        </Field>

        <Field label="開封日（任意・酸化目安の起点になります）">
          <input
            type="date"
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-zinc-900"
          />
        </Field>

        <Field label="毎日のルーティン（任意）">
          <Chips
            options={['', 'inbath', 'outbath'] as const}
            value={routine}
            onChange={setRoutine}
            labels={{ '': '使わない', inbath: 'お風呂で洗う', outbath: 'お風呂上がりに塗る' }}
          />
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-safe">
        <button
          onClick={save}
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-zinc-900 py-4 text-[15px] font-semibold text-white shadow-lg shadow-zinc-900/20 active:bg-zinc-700 disabled:opacity-30"
        >
          {editId ? '保存する' : '追加する'}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-xs font-semibold tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
            value === o
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50'
          }`}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
