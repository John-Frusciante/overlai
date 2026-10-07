'use client';

/**
 * 在庫から外す前の確認。アラートの行の中にその場で開く。
 *
 * 外すと、今後の判定でその品と照合しなくなる。何が起きるかを1行で伝えてから外す。
 */
export function ConfirmRemove({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl bg-surface/70 p-3">
      <p className="text-[12.5px] leading-relaxed text-ink/80">
        在庫から外すと、今後の判定で照合しなくなります。
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl bg-surface-sunken py-2.5 text-[13px] font-medium text-muted transition-transform active:scale-[0.98]"
        >
          やめる
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-ink py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
        >
          外す
        </button>
      </div>
    </div>
  );
}
