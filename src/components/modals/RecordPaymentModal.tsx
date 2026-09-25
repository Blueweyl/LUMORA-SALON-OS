import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { apptOutstanding, getOutstandingAppointments, serviceNames } from '../../lib/selectors';
import { formatDateShort } from '../../lib/dates';

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
  const state = useStore((s) => s);
  const currency = useStore((s) => s.business.currencySymbol);
  const close = useStore((s) => s.closeRecordPayment);
  const update = useStore((s) => s.updateRecordPaymentField);
  const save = useStore((s) => s.saveRecordPayment);

  if (!show) return null;

  const clients = state.clients.filter((c) => !c.archived || c.id === draft.clientId).sort((a, b) => a.name.localeCompare(b.name));
  const owedAppts = draft.clientId ? getOutstandingAppointments(state, draft.clientId) : [];
  const linked = owedAppts.find((a) => a.id === draft.apptId);
  const linkedOwed = linked ? apptOutstanding(state, linked) : 0;
  const inputCls = 'rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] font-normal text-ink-900';

  return (
    <Modal onClose={close} maxWidth={420} labelledBy="record-payment-title">
      <ModalTitle id="record-payment-title">Record Payment</ModalTitle>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Client
            <select value={draft.clientId} onChange={(e) => update('clientId', e.target.value)} className={inputCls}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          {owedAppts.length > 0 && (
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Apply to an unpaid visit
              <select
                value={draft.apptId}
                onChange={(e) => {
                  const id = e.target.value;
                  update('apptId', id);
                  const a = owedAppts.find((x) => x.id === id);
                  if (a) {
                    update('amount', apptOutstanding(state, a));
                    update('type', 'balance');
                  }
                }}
                className={inputCls}
              >
                <option value="">Not for a specific visit</option>
                {owedAppts.map((a) => (
                  <option key={a.id} value={a.id}>{formatDateShort(a.date)} · {serviceNames(state, a.serviceIds)} · {currency}{apptOutstanding(state, a).toFixed(2)} owed</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Amount ({currency})
            <input type="number" inputMode="decimal" min={0} step="0.01" value={draft.amount || ''} onChange={(e) => update('amount', Number(e.target.value))} className={inputCls} placeholder="0.00" />
            {linked && draft.amount > linkedOwed + 0.005 && <span className="text-[11.5px] font-normal text-warn-600">That's more than the {currency}{linkedOwed.toFixed(2)} owed for this visit.</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Type
            <select value={draft.type} onChange={(e) => update('type', e.target.value as typeof draft.type)} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="Payment method">
            {(['Card', 'Cash'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={draft.method === m}
                onClick={() => update('method', m)}
                className={`min-h-[44px] flex-1 rounded-[10px] border py-2.5 text-[13px] font-bold ${draft.method === m ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Note (optional)
            <input value={draft.note} onChange={(e) => update('note', e.target.value)} className={inputCls} placeholder="e.g. Paid in person" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700">Cancel</button>
          <button type="submit" className="min-h-[44px] rounded-lg bg-plum-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-700">Record Payment</button>
        </div>
      </form>
    </Modal>
  );
}
