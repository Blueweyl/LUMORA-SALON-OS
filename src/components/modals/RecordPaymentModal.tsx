import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { apptPaymentCap, cardsForClient, getOutstandingAppointments, isOpenStatus, serviceNames } from '../../lib/selectors';
import { formatDateShort } from '../../lib/dates';
import type { RecordPaymentDraft } from '../../store/types';

const TYPES: { value: RecordPaymentDraft['type']; label: string }[] = [
  { value: 'full', label: 'Other payment' },
  { value: 'product', label: 'Retail product' },
  { value: 'package', label: 'Package / membership' },
  { value: 'gift-card', label: 'Sell a gift card' },
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

  const money = (n: number) => `${currency}${n.toFixed(2)}`;
  const clients = state.clients.filter((c) => !c.archived || c.id === draft.clientId).sort((a, b) => a.name.localeCompare(b.name));
  const owedAppts = draft.clientId ? getOutstandingAppointments(state, draft.clientId) : [];
  const openAppts = draft.clientId
    ? state.appointments.filter((a) => a.clientId === draft.clientId && isOpenStatus(a) && apptPaymentCap(state, a) > 0).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    : [];
  const linked = state.appointments.find((a) => a.id === draft.apptId);
  const cap = linked ? apptPaymentCap(state, linked) : 0;
  const cards = draft.clientId ? cardsForClient(state, draft.clientId) : [];
  const card = cards.find((c) => c.id === draft.giftCardId);
  const selling = draft.type === 'gift-card';
  const overCap = Boolean(linked) && draft.amount > cap + 0.005;
  const overCard = Boolean(card) && draft.amount > (card?.balance ?? 0) + 0.005;
  const needsCard = draft.method === 'Gift card' && !card;
  const blocked = !draft.clientId || !(draft.amount > 0) || overCap || overCard || needsCard;
  const inputCls = 'rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] font-normal text-ink-900';
  const methods: RecordPaymentDraft['method'][] = selling || cards.length === 0 ? ['Card', 'Cash'] : ['Card', 'Cash', 'Gift card'];

  return (
    <Modal onClose={close} maxWidth={440} labelledBy="record-payment-title">
      <ModalTitle id="record-payment-title">{selling ? 'Sell a Gift Card' : 'Record Payment'}</ModalTitle>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            {selling ? 'Bought by' : 'Client'}
            <select value={draft.clientId} onChange={(e) => update('clientId', e.target.value)} className={inputCls}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          {!selling && (owedAppts.length > 0 || openAppts.length > 0) && (
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              What is this payment for?
              <select value={draft.apptId} onChange={(e) => update('apptId', e.target.value)} className={inputCls}>
                <option value="">Not for a specific visit</option>
                {owedAppts.length > 0 && (
                  <optgroup label="Unpaid visits">
                    {owedAppts.map((a) => (
                      <option key={a.id} value={a.id}>{formatDateShort(a.date)} · {serviceNames(state, a.serviceIds)} · {money(apptPaymentCap(state, a))} owed</option>
                    ))}
                  </optgroup>
                )}
                {openAppts.length > 0 && (
                  <optgroup label="Deposit for a booking">
                    {openAppts.map((a) => (
                      <option key={a.id} value={a.id}>{formatDateShort(a.date)} · {serviceNames(state, a.serviceIds)} · {money(apptPaymentCap(state, a))} left to pay</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            {selling ? `Gift card value (${currency})` : `Amount (${currency})`}
            <input type="number" inputMode="decimal" min={0} step="0.01" value={draft.amount || ''} onChange={(e) => update('amount', Number(e.target.value))} aria-invalid={overCap || overCard} className={inputCls} placeholder="0.00" />
            {linked && !overCap && <span className="text-[11.5px] font-normal text-ink-400">Up to {money(cap)} for this {linked.status === 'completed' ? 'visit' : 'booking'}.</span>}
            {overCap && <span role="alert" className="text-[11.5px] font-semibold text-bad-600">That's more than the {money(cap)} {linked?.status === 'completed' ? 'owed for this visit' : 'left to pay on this booking'}. Extra can be added as a tip at checkout.</span>}
            {overCard && card && <span role="alert" className="text-[11.5px] font-semibold text-bad-600">{card.code} only has {money(card.balance)} left.</span>}
          </label>
          {!linked && (
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Type
              <select value={draft.type === 'balance' || draft.type === 'deposit' ? 'full' : draft.type} onChange={(e) => update('type', e.target.value as RecordPaymentDraft['type'])} className={inputCls}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {selling && <span className="text-[11.5px] font-normal text-ink-400">A gift card code is created automatically. Its balance can be used at checkout.</span>}
            </label>
          )}
          <div>
            <div className="mb-1.5 text-[12.5px] font-bold text-ink-500">{selling ? 'Paid by' : 'Payment method'}</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Payment method">
              {methods.map((m) => (
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
          </div>
          {draft.method === 'Gift card' && !selling && (
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Which gift card / credit?
              <select value={draft.giftCardId} onChange={(e) => update('giftCardId', e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} · {money(c.balance)} left{c.clientId === draft.clientId ? ' · this client' : c.purchasedBy ? ` · bought by ${c.purchasedBy}` : ''}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Note (optional)
            <input value={draft.note} onChange={(e) => update('note', e.target.value)} className={inputCls} placeholder={selling ? 'e.g. For her sister’s birthday' : 'e.g. Paid in person'} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700">Cancel</button>
          <button type="submit" aria-disabled={blocked} className={`min-h-[44px] rounded-lg px-5 py-2.5 text-sm font-bold text-white ${blocked ? 'cursor-not-allowed bg-plum-600/50' : 'bg-plum-600 hover:bg-plum-700'}`}>
            {selling ? `Sell ${draft.amount > 0 ? money(draft.amount) : ''} Gift Card`.replace('  ', ' ') : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
