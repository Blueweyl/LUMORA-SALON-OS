import { useMemo } from 'react';
import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { Icon } from '../icons';
import { findConflicts, suggestTimes } from '../../lib/scheduling';
import { formatDuration, formatTime } from '../../lib/dates';

export function NewApptModal() {
  const show = useStore((s) => s.showNewAppt);
  const draft = useStore((s) => s.newApptDraft);
  const clients = useStore((s) => s.clients);
  const services = useStore((s) => s.services);
  const staff = useStore((s) => s.staff);
  const appointments = useStore((s) => s.appointments);
  const business = useStore((s) => s.business);
  const close = useStore((s) => s.closeNewAppt);
  const update = useStore((s) => s.updateNewApptField);
  const toggleService = useStore((s) => s.toggleNewApptService);
  const save = useStore((s) => s.saveNewAppt);

  const selectedServices = services.filter((sv) => draft.serviceIds.includes(sv.id));
  const price = selectedServices.reduce((sum, sv) => sum + sv.price, 0);
  const duration = selectedServices.reduce((sum, sv) => sum + sv.duration, 0);
  const total = Math.max(0, price - draft.discount);
  const balance = Math.max(0, total - draft.deposit);

  const conflicts = useMemo(
    () => findConflicts(appointments, draft.staffId, draft.date, draft.time, duration),
    [appointments, draft.staffId, draft.date, draft.time, duration],
  );
  const suggestions = useMemo(
    () => suggestTimes(appointments, draft.staffId, draft.date, duration, business.bufferMin),
    [appointments, draft.staffId, draft.date, duration, business.bufferMin],
  );
  const client = clients.find((c) => c.id === draft.clientId);
  const conflictClientName = (apptId: string) => clients.find((c) => c.id === appointments.find((a) => a.id === apptId)?.clientId)?.name;

  if (!show) return null;

  const categories = Array.from(new Set(services.filter((s) => s.active).map((s) => s.category)));

  return (
    <Modal onClose={close} maxWidth={560}>
      <ModalTitle>New Appointment</ModalTitle>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Client
          <select value={draft.clientId} onChange={(e) => update('clientId', e.target.value)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] text-ink-900">
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {client && <span className="text-[11.5px] font-normal text-ink-400">{client.visits} visits · Lifetime {business.currencySymbol}{client.lifetimeSpend.toFixed(0)}</span>}
        </label>

        <div>
          <div className="mb-2 text-[12.5px] font-bold text-ink-500">Services</div>
          <div className="flex max-h-[220px] flex-col gap-3 overflow-y-auto rounded-[12px] border border-ivory-400 p-3">
            {categories.map((cat) => (
              <div key={cat}>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{cat}</div>
                <div className="flex flex-col gap-1">
                  {services.filter((sv) => sv.category === cat && sv.active).map((sv) => {
                    const checked = draft.serviceIds.includes(sv.id);
                    return (
                      <button
                        key={sv.id}
                        onClick={() => toggleService(sv.id)}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] ${checked ? 'bg-plum-50' : 'hover:bg-ivory-100'}`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-2 ${checked ? 'border-plum-600 bg-plum-600 text-white' : 'border-ivory-500'}`}>
                            {checked && <Icon name="check" size={11} />}
                          </span>
                          <span className="font-semibold text-ink-900">{sv.name}</span>
                          <span className="text-[11.5px] text-ink-400">{formatDuration(sv.duration)}</span>
                        </span>
                        <span className="font-semibold text-ink-700">{business.currencySymbol}{sv.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[12.5px] font-bold text-ink-500">Staff</div>
          <div className="flex flex-wrap gap-2">
            {staff.map((st) => (
              <button
                key={st.id}
                onClick={() => update('staffId', st.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${draft.staffId === st.id ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Date
            <input type="date" value={draft.date} onChange={(e) => update('date', e.target.value)} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Time
            <input type="time" value={draft.time} onChange={(e) => update('time', e.target.value)} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
        </div>

        {suggestions.length > 0 && (
          <div className="rounded-xl border border-ivory-400 bg-ivory-100 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-500"><Icon name="sparkles" size={13} className="text-plum-600" /> Smart scheduling · {formatDuration(duration || 30)} needed</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((t) => (
                <button key={t} onClick={() => update('time', t)} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${draft.time === t ? 'border-plum-600 bg-plum-600 text-white' : 'border-ivory-400 bg-white text-ink-700 hover:border-plum-600'}`}>
                  {formatTime(t)}
                </button>
              ))}
            </div>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-bad-100 bg-bad-100/60 p-3">
            <Icon name="alert" size={16} className="mt-0.5 flex-none text-bad-600" />
            <div className="text-[12.5px] leading-relaxed text-bad-600">
              <b>Scheduling conflict:</b> overlaps {conflictClientName(conflicts[0].appt.id) || 'another client'}'s appointment at {formatTime(conflicts[0].appt.time)}. Pick another time or staff member.
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
            <div className="text-[11px] text-ink-400">Duration</div>
            <div className="text-[14px] font-bold text-ink-900">{formatDuration(duration)}</div>
          </div>
          <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
            <div className="text-[11px] text-ink-400">Subtotal</div>
            <div className="text-[14px] font-bold text-ink-900">{business.currencySymbol}{price.toFixed(0)}</div>
          </div>
          <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
            <div className="text-[11px] text-ink-400">Total</div>
            <div className="text-[14px] font-bold text-plum-600">{business.currencySymbol}{total.toFixed(0)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Discount ({business.currencySymbol})
            <input type="number" min={0} value={draft.discount || ''} onChange={(e) => update('discount', Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" placeholder="0" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Deposit ({business.currencySymbol})
            <div className="flex gap-1.5">
              <input type="number" min={0} value={draft.deposit || ''} onChange={(e) => update('deposit', Number(e.target.value))} className="w-full rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" placeholder="0" />
              <button
                type="button"
                onClick={() => update('deposit', Math.round(total * (business.depositPct / 100)))}
                className="flex-none rounded-[10px] border border-ivory-400 px-2.5 text-[11px] font-bold text-ink-500 hover:border-plum-600 hover:text-plum-600"
              >
                {business.depositPct}%
              </button>
            </div>
          </label>
        </div>
        {draft.deposit > 0 && <div className="-mt-3 text-[12px] text-ink-400">Balance due at checkout: {business.currencySymbol}{balance.toFixed(0)}</div>}

        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Repeats
          <select value={draft.recurring} onChange={(e) => update('recurring', e.target.value as typeof draft.recurring)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px]">
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Notes
          <textarea value={draft.notes} onChange={(e) => update('notes', e.target.value)} rows={2} className="resize-none rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" placeholder="Formula notes, requests…" />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={close} className="rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700">Cancel</button>
        <button onClick={save} className="rounded-lg bg-plum-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-700">Confirm Appointment</button>
      </div>
    </Modal>
  );
}
