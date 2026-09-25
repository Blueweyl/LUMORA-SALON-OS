import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { Icon } from '../icons';

export function NewClientModal() {
  const show = useStore((s) => s.showNewClient);
  const draft = useStore((s) => s.newClientDraft);
  const staff = useStore((s) => s.staff);
  const update = useStore((s) => s.updateNewClientField);
  const close = useStore((s) => s.closeNewClient);
  const save = useStore((s) => s.saveNewClient);
  const justAddedId = useStore((s) => s.justAddedClientId);
  const justAddedClient = useStore((s) => s.clients.find((c) => c.id === justAddedId));
  const bookForJustAdded = useStore((s) => s.bookForJustAdded);
  const openJustAddedProfile = useStore((s) => s.openJustAddedProfile);
  const dismissJustAdded = useStore((s) => s.dismissJustAdded);

  if (justAddedClient) {
    return (
      <Modal onClose={dismissJustAdded} maxWidth={400} labelledBy="client-added-title">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-good-100 text-good-600">
            <Icon name="check" size={22} />
          </div>
          <h2 id="client-added-title" className="mb-1.5 font-serif text-[22px] font-medium text-ink-900">{justAddedClient.name} added</h2>
          <p className="mb-6 text-[13.5px] text-ink-500">What would you like to do next?</p>
          <div className="mx-auto flex max-w-[280px] flex-col gap-2.5">
            <button onClick={bookForJustAdded} className="rounded-[10px] bg-plum-600 py-3 text-[14px] font-bold text-white hover:bg-plum-700">
              Book Their First Appointment
            </button>
            <button onClick={openJustAddedProfile} className="rounded-[10px] border border-ivory-400 py-3 text-[13.5px] font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600">
              Open Client Profile
            </button>
            <button onClick={dismissJustAdded} className="py-2 text-[12.5px] font-semibold text-ink-400">
              Done for now
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!show) return null;

  return (
    <Modal onClose={close} labelledBy="new-client-title">
      <ModalTitle id="new-client-title">New Client</ModalTitle>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Full name
          <input autoFocus value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Priya Nair" className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Phone
            <input type="tel" inputMode="tel" autoComplete="off" value={draft.phone} onChange={(e) => update('phone', e.target.value)} placeholder="(415) 555-0100" className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Email
            <input type="email" inputMode="email" autoComplete="off" value={draft.email} onChange={(e) => update('email', e.target.value)} placeholder="priya@email.com" className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Birthday
            <input type="date" value={draft.birthday ? `2000-${draft.birthday}` : ''} onChange={(e) => update('birthday', e.target.value.slice(5))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Preferred staff
            <select value={draft.preferredStaffId} onChange={(e) => update('preferredStaffId', e.target.value)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px]">
              <option value="">No preference</option>
              {staff.filter((st) => !st.archived).map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Allergies / sensitivities
          <input value={draft.allergies} onChange={(e) => update('allergies', e.target.value)} placeholder="None known" className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Notes
          <textarea value={draft.notes} onChange={(e) => update('notes', e.target.value)} rows={2} placeholder="Anything worth remembering…" className="resize-none rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700">Cancel</button>
        <button type="submit" className="min-h-[44px] rounded-lg bg-plum-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-700">Save Client</button>
      </div>
      </form>
    </Modal>
  );
}
