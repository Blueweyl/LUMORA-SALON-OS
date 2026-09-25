import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';
import { apptBill, apptOutstanding, getNextApptForClient, rebookWeeksFor } from '../../lib/selectors';
import { isMoneyIn } from '../../lib/finance';
import { formatDateLong, formatTime, todayISO } from '../../lib/dates';

export function CompleteScreenModal() {
  const apptId = useStore((s) => s.justCompletedApptId);
  const state = useStore((s) => s);
  const close = useStore((s) => s.closeCompleteScreen);
  const rebook = useStore((s) => s.rebookFromModal);

  const appt = state.appointments.find((a) => a.id === apptId);
  if (!appt) return null;
  const client = state.clients.find((c) => c.id === appt.clientId);
  const cur = state.business.currencySymbol;
  const weeks = rebookWeeksFor(state, appt.serviceIds);
  const today = todayISO();
  const todays = state.payments.filter((p) => p.apptId === appt.id && !p.voided && p.date === today);
  const collectedToday = todays.filter(isMoneyIn).reduce((sum, p) => sum + p.amount, 0);
  const fromCards = todays.filter((p) => p.method === 'Gift card').reduce((sum, p) => sum + p.amount, 0);
  const owed = apptOutstanding(state, appt);
  const next = getNextApptForClient(state, appt.clientId);
  const first = client?.name.split(' ')[0] ?? 'Client';

  return (
    <Modal onClose={close} maxWidth={400} labelledBy="complete-title">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good-100 text-good-600">
          <Icon name="sparkles" size={26} />
        </div>
        <h2 id="complete-title" className="mb-1.5 font-serif text-[24px] font-medium text-ink-900">Service complete ✨</h2>
        <p className="mb-1 text-[14px] text-ink-500">
          {first} is all set — visit total {cur}{apptBill(appt).toFixed(2)}{appt.tip > 0 ? ` + ${cur}${appt.tip.toFixed(2)} tip` : ''}.
          {collectedToday > 0 && <> {cur}{collectedToday.toFixed(2)} collected today.</>}
          {fromCards > 0 && <> {cur}{fromCards.toFixed(2)} paid from gift card / credit.</>}
        </p>
        {owed > 0 && <p className="mb-1 text-[12.5px] font-semibold text-bad-600">{cur}{owed.toFixed(2)} still owed</p>}
        {client && client.loyaltyPoints > 0 && (
          <p className="mb-5 text-[12.5px] font-semibold text-plum-600">{client.loyaltyPoints} loyalty points on their account</p>
        )}
        {next ? (
          <div className="mb-6 rounded-xl border border-ivory-400 bg-ivory-100 p-4 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Already booked</div>
            <div className="text-[15px] font-bold text-ink-900">{formatDateLong(next.date)}, {formatTime(next.time)}</div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-ivory-400 bg-ivory-100 p-4 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Suggested next visit</div>
            <div className="text-[15px] font-bold text-ink-900">In {weeks} weeks</div>
          </div>
        )}
        <div className="mx-auto flex max-w-[280px] flex-col gap-2.5">
          {!next && client && !client.archived && (
            <button onClick={rebook} className="min-h-[48px] rounded-[10px] bg-plum-600 py-3 text-[14px] font-bold text-white hover:bg-plum-700">
              Rebook {first}
            </button>
          )}
          <button onClick={close} className="min-h-[40px] py-2 text-[12.5px] font-semibold text-ink-400">
            {next ? 'Done' : 'Not now'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
