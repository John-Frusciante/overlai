'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toResizedDataUrl } from '@/lib/image';
import {
  addStock,
  loadCustomCategories,
  loadCustomRoutines,
  loadStock,
  saveCustomCategories,
  saveCustomRoutines,
  updateStock,
} from '@/lib/storage';
import {
  BUILTIN_ROUTINES,
  MAX_ROUTINE_LENGTH,
  routineChipLabel,
  validateRoutineName,
} from '@/lib/routine';
import { toItemForm, toStockCategory } from '@/lib/mapping';
import { BUILTIN_CATEGORIES, MAX_CATEGORY_LENGTH, validateCategoryName } from '@/lib/categories';
import type {
  ApiErrorBody,
  DoseTime,
  ExtractionResult,
  ItemForm,
  RoutineKind,
  StockCategory,
} from '@/lib/types';

/**
 * 在庫の追加・編集 — 企画書 §4 ①「登録は3経路」のうちカメラ読み取りと手入力
 *
 * 「まず全部登録してください」を要求しない設計が鍵なので、
 * 成分の読み取りは任意であり、手入力だけでも登録できる。
 *
 * `?id=` が付いていれば既存アイテムの編集として動く。
 */

const FORMS: ItemForm[] = [
  '錠剤', 'カプセル', '導入液', '化粧水', '美容液', 'ローション', '乳液',
  'クリーム', '軟膏', 'オイル', 'シャンプー', 'トリートメント', '洗顔', 'ボディソープ', 'その他',
];

const DOSE_TIMES: DoseTime[] = ['朝', '昼', '夜'];

/**
 * 服薬の設定欄を出すかどうか。
 *
 * 剤形だけで判断すると、粉薬やシロップを「その他」で登録した人に欄が出ない。
 * 逆にカテゴリだけで見ると外用の処方薬にも出てしまうため、両方を見る。
 */
function takesDose(form: ItemForm, category: StockCategory): boolean {
  if (form === '錠剤' || form === 'カプセル') return true;
  return category === '処方薬' || category === '市販薬・サプリ';
}

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

  /** 服薬設定。空のタイミングは「今日のお薬に出さない」を意味する */
  const [doseTimes, setDoseTimes] = useState<DoseTime[]>([]);
  const [perTime, setPerTime] = useState('1');
  const [remainingCount, setRemainingCount] = useState('');
  const [remainingUnit, setRemainingUnit] = useState('錠');

  /** ユーザーが追加したカテゴリ。この画面から新規作成もできる */
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState('');

  /** ユーザーが作ったルーティンの区分。カテゴリと同じ扱い */
  const [customRoutines, setCustomRoutines] = useState<string[]>([]);
  const [newRoutine, setNewRoutine] = useState<string | null>(null);
  const [routineError, setRoutineError] = useState('');

  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  /** 編集対象のid。null なら新規追加 */
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    setCustomCategories(loadCustomCategories());
    setCustomRoutines(loadCustomRoutines());
  }, []);

  /** その場でカテゴリを作って、そのまま選択状態にする */
  const commitNewCategory = useCallback(() => {
    const result = validateCategoryName(newCategory ?? '', [...customCategories]);
    if (!result.ok) {
      setCategoryError(result.reason);
      return;
    }
    const next = [...customCategories, result.name];
    saveCustomCategories(next);
    setCustomCategories(next);
    setCategory(result.name);
    setNewCategory(null);
    setCategoryError('');
  }, [newCategory, customCategories]);

  /** その場でルーティンを作って、そのまま選択状態にする */
  const commitNewRoutine = useCallback(() => {
    const result = validateRoutineName(newRoutine ?? '', [...customRoutines]);
    if (!result.ok) {
      setRoutineError(result.reason);
      return;
    }
    const next = [...customRoutines, result.name];
    saveCustomRoutines(next);
    setCustomRoutines(next);
    setRoutine(result.name);
    setNewRoutine(null);
    setRoutineError('');
  }, [newRoutine, customRoutines]);

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
    setDoseTimes(item.dose?.times ?? []);
    setPerTime(String(item.dose?.perTime ?? 1));
    setRemainingCount(item.remaining ? String(item.remaining.count) : '');
    setRemainingUnit(item.remaining?.unit ?? '錠');
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

    // 内服として扱わない剤形・カテゴリに変えたときは、残っていた服薬設定を落とす。
    // undefined を渡すと updateStock のマージで消える（lib/storage.ts）
    const oral = takesDose(form, category);
    const count = Number(remainingCount);

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
      // 洗う⇄塗るを移した項目が、移した先で手動の並びに割り込まないようにする
      ...(editId && loadStock().find((i) => i.id === editId)?.routine !== (routine || undefined)
        ? { routineOrder: undefined }
        : {}),
      dose:
        oral && doseTimes.length > 0
          ? {
              // トグルした順ではなく朝→昼→夜で持つ
              times: DOSE_TIMES.filter((t) => doseTimes.includes(t)),
              perTime: Math.max(1, Math.round(Number(perTime) || 1)),
            }
          : undefined,
      remaining:
        oral && remainingCount.trim() !== '' && Number.isFinite(count) && count >= 0
          ? { count: Math.round(count), unit: remainingUnit.trim() || '錠' }
          : undefined,
    };
    if (editId) updateStock(editId, values);
    else addStock(values);
    router.push('/');
  }, [
    editId,
    name,
    category,
    form,
    ingredients,
    status,
    openedAt,
    routine,
    doseTimes,
    perTime,
    remainingCount,
    remainingUnit,
    router,
  ]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">
          {editId ? 'ストックを編集' : 'ストックを追加'}
        </h1>
        <button
          onClick={() => router.back()}
          className="text-[14px] font-medium text-muted active:text-ink"
        >
          キャンセル
        </button>
      </header>

      {/* 成分の読み取り */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={reading}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl transition-transform active:scale-[0.99] border border-dashed border-line-strong bg-surface py-6 shadow-e1 text-[14.5px] font-semibold text-muted active:bg-surface-sunken disabled:opacity-50"
      >
        {reading ? (
          <>
            <Loader2 size={17} strokeWidth={2.2} className="animate-spin" />
            成分を読み取っています…
          </>
        ) : (
          <>
            <Camera size={18} strokeWidth={2} />
            成分表示を撮って読み取る
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={readFromImage} className="hidden" />
      {readError && <p className="mt-2 px-1 text-[13px] text-red-600">{readError}</p>}
      <p className="mt-2 px-1 text-[12.5px] text-faint">
        読み取らずに手で入力しても登録できます。
      </p>

      {/* フォーム */}
      <div className="mt-7 space-y-5">
        <Field label="商品名">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：しっとり化粧水"
            className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
          />
        </Field>

        <Field label="カテゴリ">
          <div className="flex flex-wrap gap-1.5">
            {[...BUILTIN_CATEGORIES, ...customCategories].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setCategory(o)}
                className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                  category === o
                    ? 'bg-brand text-white'
                    : 'border border-line bg-surface text-muted active:bg-surface-sunken'
                }`}
              >
                {o}
              </button>
            ))}
            {newCategory === null && (
              <button
                type="button"
                onClick={() => {
                  setNewCategory('');
                  setCategoryError('');
                }}
                className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3.5 py-2 text-[13.5px] font-medium text-muted transition-colors active:bg-surface-sunken"
              >
                <Plus size={14} strokeWidth={2.6} />
                カテゴリを追加
              </button>
            )}
          </div>

          {newCategory !== null && (
            <div className="mt-2">
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => {
                    setNewCategory(e.target.value);
                    setCategoryError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitNewCategory();
                    }
                    if (e.key === 'Escape') setNewCategory(null);
                  }}
                  maxLength={MAX_CATEGORY_LENGTH}
                  placeholder="例：出先用"
                  className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
                />
                <button
                  type="button"
                  onClick={commitNewCategory}
                  aria-label="カテゴリを作る"
                  className="flex w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white transition-transform active:scale-95"
                >
                  <Check size={17} strokeWidth={2.6} />
                </button>
                <button
                  type="button"
                  onClick={() => setNewCategory(null)}
                  aria-label="やめる"
                  className="flex w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-muted transition-transform active:scale-95"
                >
                  <X size={17} strokeWidth={2.2} />
                </button>
              </div>
              {categoryError ? (
                <p className="mt-1.5 px-1 text-[12.5px] text-red-600">{categoryError}</p>
              ) : (
                <p className="mt-1.5 px-1 text-[12.5px] text-faint">
                  「出先用」「常備薬」など、自分の分け方で作れます。
                </p>
              )}
            </div>
          )}
        </Field>

        <Field label="剤形">
          <select
            value={form}
            onChange={(e) => setForm(e.target.value as ItemForm)}
            className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
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
            className="w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
          />
        </Field>

        <Field label="状態（任意）">
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="例：残12錠 / 使用中"
            className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
          />
        </Field>

        <Field label="開封日（任意・酸化目安の起点になります）">
          <input
            type="date"
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
          />
        </Field>

        <Field label="毎日のルーティン（任意）">
          <div className="flex flex-wrap gap-1.5">
            {['', ...BUILTIN_ROUTINES, ...customRoutines].map((o) => (
              <button
                key={o || 'none'}
                type="button"
                onClick={() => setRoutine(o)}
                className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                  routine === o
                    ? 'bg-brand text-white'
                    : 'border border-line bg-surface text-muted active:bg-surface-sunken'
                }`}
              >
                {o === '' ? '使わない' : routineChipLabel(o)}
              </button>
            ))}
            {newRoutine === null && (
              <button
                type="button"
                onClick={() => {
                  setNewRoutine('');
                  setRoutineError('');
                }}
                className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3.5 py-2 text-[13.5px] font-medium text-muted transition-colors active:bg-surface-sunken"
              >
                <Plus size={14} strokeWidth={2.6} />
                ルーティンを追加
              </button>
            )}
          </div>

          {newRoutine !== null && (
            <div className="mt-2">
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={newRoutine}
                  onChange={(e) => {
                    setNewRoutine(e.target.value);
                    setRoutineError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitNewRoutine();
                    }
                    if (e.key === 'Escape') setNewRoutine(null);
                  }}
                  maxLength={MAX_ROUTINE_LENGTH}
                  placeholder="例：朝のスキンケア"
                  className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
                />
                <button
                  type="button"
                  onClick={commitNewRoutine}
                  aria-label="ルーティンを作る"
                  className="flex w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white transition-transform active:scale-95"
                >
                  <Check size={17} strokeWidth={2.6} />
                </button>
                <button
                  type="button"
                  onClick={() => setNewRoutine(null)}
                  aria-label="やめる"
                  className="flex w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-muted transition-transform active:scale-95"
                >
                  <X size={17} strokeWidth={2.2} />
                </button>
              </div>
              {routineError ? (
                <p className="mt-1.5 px-1 text-[12.5px] text-red-600">{routineError}</p>
              ) : (
                <p className="mt-1.5 px-1 text-[12.5px] text-faint">
                  「朝のスキンケア」「寝る前」など、自分の生活に合わせて作れます。
                </p>
              )}
            </div>
          )}
        </Field>

        {/* 服薬設定 — 飲むものにだけ出す */}
        {takesDose(form, category) && (
          <div className="space-y-5 rounded-2xl border border-line bg-surface-sunken/60 p-4">
            <Field label="飲むタイミング（任意）">
              <div className="flex flex-wrap gap-1.5">
                {DOSE_TIMES.map((t) => {
                  const on = doseTimes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setDoseTimes(
                          on ? doseTimes.filter((x) => x !== t) : [...doseTimes, t],
                        )
                      }
                      className={`rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors ${
                        on
                          ? 'bg-brand text-white'
                          : 'border border-line bg-surface text-muted active:bg-surface-sunken'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 px-1 text-[12.5px] text-faint">
                選ぶと「今日のルーティン」に並び、飲んだ記録を付けられます。
              </p>
            </Field>

            {doseTimes.length > 0 && (
              <Field label="1回に飲む量">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={perTime}
                    onChange={(e) => setPerTime(e.target.value)}
                    className="w-24 rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] tabular-nums shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
                  />
                  <span className="text-[14px] text-muted">{remainingUnit.trim() || '錠'}</span>
                </div>
              </Field>
            )}

            <Field label="残量（任意・飲んだ記録に合わせて減ります）">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={remainingCount}
                  onChange={(e) => setRemainingCount(e.target.value)}
                  placeholder="28"
                  className="w-24 rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] tabular-nums shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
                />
                <input
                  value={remainingUnit}
                  onChange={(e) => setRemainingUnit(e.target.value)}
                  aria-label="残量の単位"
                  className="w-20 rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] shadow-e1 outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(30,42,69,0.07)]"
                />
              </div>
            </Field>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-safe">
        <button
          onClick={save}
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-brand py-4 text-[15px] font-semibold text-white shadow-e3 transition-transform active:scale-[0.985] active:bg-brand-soft disabled:opacity-30"
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
      <span className="mb-1.5 block px-1 text-xs font-semibold tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
