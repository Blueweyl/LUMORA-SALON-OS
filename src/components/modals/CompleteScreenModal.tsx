import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export function CompleteScreenModal() {
  const apptId = useStore((s) => s.justCompletedApptId);
  const state = useStore((s) => s);
  const close = useStore((s) => s.closeCompleteScreen);
  const rebook = useStore((s) => s.rebookFromModal);

  const appt = state.appointments.find((a) => a.id === apptId);
  if (!appt) return null;
  const client = state.clients.find((c) => c.id === appt.clientId);
  const weeks = state.business.rebookWeeks;

  return (
    <Modal onClose={close} maxWidth={400}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good-100 text-good-600">
          <Icon name="sparkles" size={26} />
        </div>
        <h2 className="mb-1.5 font-serif text-[24px] font-medium text-ink-900">Service complete ✨</h2>
        <p className="mb-1 text-[14px] text-ink-500">{client?.name} is all set — {state.business.currencySymbol}{(appt.price - appt.discount + appt.tip).toFixed(0)} collected.</p>
        {client && client.loyaltyPoints > 0 && (
          <p className="mb-5 text-[12.5px] font-semibold text-plum-600">{client.loyaltyPoints} loyalty points on their account</p>
        )}
        <div className="mb-6 rounded-xl border border-ivory-400 bg-ivory-100 p-4 text-left">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Suggested next visit</div>
          <div className="text-[15px] font-bold text-ink-900">In {weeks} weeks</div>
        </div>
        <div className="mx-auto flex max-w-[280px] flex-col gap-2.5">
          <button onClick={rebook} className="rounded-[10px] bg-plum-600 py-3 text-[14px] font-bold text-white hover:bg-plum-700">
            Rebook {client?.name.split(' ')[0]}
          </button>
          <button onClick={close} className="py-2 text-[12.5px] font-semibold text-ink-400">
            Not now
          </button>
        </div>
      </div>
    </Modal>
  );
}
