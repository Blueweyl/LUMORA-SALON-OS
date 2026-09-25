import { useStore } from '../../store/store';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const dialog = useStore((s) => s.confirmDialog);
  const runConfirm = useStore((s) => s.runConfirm);
  const closeConfirm = useStore((s) => s.closeConfirm);
  if (!dialog) return null;

  return (
    <Modal onClose={closeConfirm} maxWidth={420} labelledBy="confirm-title">
      <h2 id="confirm-title" className="mb-2 font-serif text-[20px] font-medium text-ink-900">{dialog.title}</h2>
      <p className="mb-6 text-sm leading-relaxed text-ink-500">{dialog.message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={closeConfirm}
          className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600"
        >
          {dialog.cancelLabel}
        </button>
        <button
          onClick={runConfirm}
          autoFocus={!dialog.destructive}
          className={`min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-bold text-white ${dialog.destructive ? 'bg-bad-500 hover:bg-bad-600' : 'bg-plum-600 hover:bg-plum-700'}`}
        >
          {dialog.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
