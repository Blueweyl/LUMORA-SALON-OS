import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';
import { apptTotal, getCancellationMatches, serviceNames } from '../../lib/selectors';

export function CancellationRescueBanner() {
  const apptId = useStore((s) => s.cancellationRescueApptId);
  const state = useStore((s) => s);
  const setId = useStore.setState;
  const copyWaitlistMessage = useStore((s) => s.copyWaitlistMessage);
  const openClient = useStore((s) => s.openClient);
  const addToWaitlist = useStore((s) => s.addToWaitlist);

  const appt = state.appointments.find((a) => a.id === apptId);
  if (!appt) return null;

  const { clientMatches, waitlistMatches } = getCancellationMatches(state, appt);
  const closeThis = () => setId({ cancellationRescueApptId: null });

  return (
    <Modal onClose={closeThis} maxWidth={440}>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-warn-100 bg-warn-100/50 p-4">
        <Icon name="alert" size={18} className="mt-0.5 flex-none text-warn-600" />
        <div>
          <div className="text-[15px] font-bold text-ink-900">${apptTotal(appt).toFixed(0)} revenue at risk</div>
          <div className="text-[12.5px] text-ink-500">{waitlistMatches.length + clientMatches.length} clients match this opening for {serviceNames(state, appt.serviceIds)}.</div>
        </div>
      </div>

      {waitlistMatches.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">On the waitlist</div>
          <div className="flex flex-col gap-1.5">
            {waitlistMatches.map((w) => {
              const c = state.clients.find((cl) => cl.id === w.clientId);
              return (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-ivory-400 px-3 py-2">
                  <span className="text-[13px] font-semibold text-ink-900">{c?.name}</span>
                  <button onClick={() => copyWaitlistMessage(w.id)} className="rounded-md border border-ivory-400 px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600">
                    Copy Message
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {clientMatches.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Other good matches</div>
          <div className="flex flex-col gap-1.5">
            {clientMatches.map((c) => (
              <button key={c.id} onClick={() => { closeThis(); openClient(c.id); }} className="flex items-center justify-between rounded-lg border border-ivory-400 px-3 py-2 text-left hover:border-plum-600">
                <span className="text-[13px] font-semibold text-ink-900">{c.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); addToWaitlist(c.id, appt.serviceIds, 'Suggested after a cancellation'); }}
                  className="rounded-md border border-ivory-400 px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600"
                >
                  Add to Waitlist
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {waitlistMatches.length === 0 && clientMatches.length === 0 && (
        <p className="mb-4 text-[13px] text-ink-400">No obvious matches yet — check the waitlist or post a Last-Minute Opening from Grow → Content.</p>
      )}

      <button onClick={closeThis} className="w-full rounded-lg border border-ivory-400 py-2.5 text-[13px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600">
        Close
      </button>
    </Modal>
  );
}
