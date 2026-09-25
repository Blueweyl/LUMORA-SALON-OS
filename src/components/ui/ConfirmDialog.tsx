import { useStore } from '../../store/store';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const dialog = useStore((s) => s.confirmDialog);
  const runConfirm = useStore((s) => s.runConfirm);
  const closeConfirm = useStore((s) => s.closeConfirm);
  const setChoice = useStore((s) => s.setConfirmChoice);
  const runAlt = useStore((s) => s.runConfirmAlt);
  if (!dialog) return null;

  return (
    <Modal onClose={closeConfirm} maxWidth={420} labelledBy="confirm-title">
      <h2 id="confirm-title" className="mb-2 font-serif text-[20px] font-medium text-ink-900">{dialog.title}</h2>
      <p className="mb-5 text-sm leading-relaxed text-ink-500">{dialog.message}</p>
      {dialog.choices && (
        <div role="radiogroup" aria-labelledby="confirm-title" className="mb-6 flex flex-col gap-2">
          {dialog.choices.map((c) => {
            const on = dialog.choice === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(c.value)}
                className={`flex min-h-[48px] items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-left ${on ? 'border-plum-600 bg-plum-50' : 'border-ivory-400'}`}
              >
                <span className={`mt-1 h-3.5 w-3.5 flex-none rounded-full border-2 ${on ? 'border-plum-600 bg-plum-600 shadow-[inset_0_0_0_2px_white]' : 'border-ivory-400'}`} />
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-bold ${on ? 'text-plum-600' : 'text-ink-900'}`}>{c.label}</span>
                  {c.hint && <span className="block text-[12px] text-ink-400">{c.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={closeConfirm}
          className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600"
        >
          {dialog.cancelLabel}
        </button>
        {dialog.altLabel && (
          <button
            onClick={runAlt}
            className="min-h-[44px] rounded-lg border border-plum-600 px-4 py-2.5 text-sm font-bold text-plum-600 hover:bg-plum-50"
          >
            {dialog.altLabel}
          </button>
        )}
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
