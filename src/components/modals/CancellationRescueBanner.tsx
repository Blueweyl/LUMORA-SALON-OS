import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';
import { apptTotal, clientName, getCancellationMatches, serviceNames } from '../../lib/selectors';
import { formatDateLong, formatTime } from '../../lib/dates';

export function CancellationRescueBanner() {
  const apptId = useStore((s) => s.cancellationRescueApptId);
  const state = useStore((s) => s);
  const setId = useStore.setState;
  const copyWaitlistMessage = useStore((s) => s.copyWaitlistMessage);
  const openClient = useStore((s) => s.openClient);
  const addToWaitlist = useStore((s) => s.addToWaitlist);
  const openNewAppt = useStore((s) => s.openNewAppt);

  const appt = state.appointments.find((a) => a.id === apptId);
  if (!appt) return null;

  const cur = state.business.currencySymbol;
  const { clientMatches, waitlistMatches } = getCancellationMatches(state, appt);
  const closeThis = () => setId({ cancellationRescueApptId: null });
  const fillSlot = (clientId: string) => {
    closeThis();
    openNewAppt({ clientId, serviceIds: appt.serviceIds, staffId: appt.staffId, date: appt.date, time: appt.time });
  };

  return (
    <Modal onClose={closeThis} maxWidth={440} labelledBy="rescue-title">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-warn-100 bg-warn-100/50 p-4">
        <Icon name="alert" size={18} className="mt-0.5 flex-none text-warn-600" />
        <div>
          <div id="rescue-title" className="text-[15px] font-bold text-ink-900">{cur}{apptTotal(appt).toFixed(0)} opening to fill</div>
          <div className="text-[12.5px] text-ink-500">{formatDateLong(appt.date)}, {formatTime(appt.time)} · {serviceNames(state, appt.serviceIds)}. {waitlistMatches.length + clientMatches.length} client{waitlistMatches.length + clientMatches.length === 1 ? '' : 's'} match.</div>
        </div>
      </div>

      {waitlistMatches.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">On the waitlist</div>
          <div className="flex flex-col gap-1.5">
            {waitlistMatches.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border border-ivory-400 px-3 py-2">
                <span className="min-w-0 truncate text-[13px] font-semibold text-ink-900">{clientName(state, w.clientId)}</span>
                <span className="flex flex-none gap-1.5">
                  <button onClick={() => copyWaitlistMessage(w.id)} className="min-h-[34px] rounded-md border border-ivory-400 px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600">Copy Message</button>
                  <button onClick={() => fillSlot(w.clientId)} className="min-h-[34px] rounded-md bg-plum-600 px-2.5 py-1 text-[11.5px] font-bold text-white">Book</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {clientMatches.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Other good matches</div>
          <div className="flex flex-col gap-1.5">
            {clientMatches.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-ivory-400 px-3 py-2">
                <button onClick={() => { closeThis(); openClient(c.id); }} className="min-w-0 truncate text-left text-[13px] font-semibold text-ink-900 hover:text-plum-600">{c.name}</button>
                <span className="flex flex-none gap-1.5">
                  <button onClick={() => addToWaitlist(c.id, appt.serviceIds, 'Suggested after a cancellation')} className="min-h-[34px] rounded-md border border-ivory-400 px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600">Add to Waitlist</button>
                  <button onClick={() => fillSlot(c.id)} className="min-h-[34px] rounded-md bg-plum-600 px-2.5 py-1 text-[11.5px] font-bold text-white">Book</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {waitlistMatches.length === 0 && clientMatches.length === 0 && (
        <p className="mb-4 text-[13px] text-ink-400">No obvious matches yet — check the waitlist or post a Last-Minute Opening from Grow → Content.</p>
      )}

      <button onClick={closeThis} className="min-h-[44px] w-full rounded-lg border border-ivory-400 py-2.5 text-[13px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600">
        Close
      </button>
    </Modal>
  );
}
