import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';

const TYPES: { value: 'full' | 'deposit' | 'balance' | 'product' | 'package' | 'gift-card'; label: string }[] = [
  { value: 'full', label: 'Full payment' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'balance', label: 'Balance due' },
  { value: 'product', label: 'Retail product' },
  { value: 'package', label: 'Package / membership' },
  { value: 'gift-card', label: 'Gift card' },
];

export function RecordPaymentModal() {
  const show = useStore((s) => s.showRecordPayment);
  const draft = useStore((s) => s.recordPaymentDraft);
  const clients = useStore((s) => s.clients);
  const currency = useStore((s) => s.business.currencySymbol);
  const close = useStore((s) => s.closeRecordPayment);
  const update = useStore((s) => s.updateRecordPaymentField);
  const save = useStore((s) => s.saveRecordPayment);

  if (!show) return null;

  return (
    <Modal onClose={close} maxWidth={420}>
      <ModalTitle>Record Payment</ModalTitle>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Client
          <select value={draft.clientId} onChange={(e) => update('clientId', e.target.value)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] text-ink-900">
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Amount ({currency})
          <input
            type="number"
            min={0}
            value={draft.amount || ''}
            onChange={(e) => update('amount', Number(e.target.value))}
            className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]"
            placeholder="0.00"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Type
          <select value={draft.type} onChange={(e) => update('type', e.target.value as typeof draft.type)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] text-ink-900">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {(['Card', 'Cash'] as const).map((m) => (
            <button
              key={m}
              onClick={() => update('method', m)}
              className={`flex-1 rounded-[10px] border py-2.5 text-[13px] font-bold ${draft.method === m ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Note (optional)
          <input value={draft.note} onChange={(e) => update('note', e.target.value)} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" placeholder="e.g. Paid in person" />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={close} className="rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700">Cancel</button>
        <button onClick={save} className="rounded-lg bg-plum-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-700">Record Payment</button>
      </div>
    </Modal>
  );
}
