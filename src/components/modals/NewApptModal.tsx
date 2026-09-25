import { useMemo } from 'react';
import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { Icon } from '../icons';
import { suggestTimes } from '../../lib/scheduling';
import { formatDateLong, formatDuration, formatTime, todayISO } from '../../lib/dates';
import { canSaveDraft, evaluateDraft } from '../../lib/booking';
import { activeClients, activeStaff, serviceNames } from '../../lib/selectors';

export function NewApptModal() {
  const show = useStore((s) => s.showNewAppt);
  const draft = useStore((s) => s.newApptDraft);
  const editingApptId = useStore((s) => s.editingApptId);
  const clients = useStore((s) => s.clients);
  const services = useStore((s) => s.services);
  const staffAll = useStore((s) => s.staff);
  const appointments = useStore((s) => s.appointments);
  const payments = useStore((s) => s.payments);
  const business = useStore((s) => s.business);
  const close = useStore((s) => s.closeNewAppt);
  const update = useStore((s) => s.updateNewApptField);
  const toggleService = useStore((s) => s.toggleNewApptService);
  const save = useStore((s) => s.saveNewAppt);

  const ev = useMemo(
    () => evaluateDraft({ newApptDraft: draft, editingApptId, services, staff: staffAll, clients, appointments, business, payments }),
    [draft, editingApptId, services, staffAll, clients, appointments, business, payments],
  );
  const suggestions = useMemo(
    () => suggestTimes(appointments, business, draft.staffId, draft.date, ev.duration || 30, 4, editingApptId ?? undefined),
    [appointments, business, draft.staffId, draft.date, ev.duration, editingApptId],
  );

  if (!show) return null;

  const cur = business.currencySymbol;
  const editing = ev.editing;
  const staff = activeStaff({ staff: staffAll });
  const bookableClients = activeClients({ clients }).sort((a, b) => a.name.localeCompare(b.name));
  const client = clients.find((c) => c.id === draft.clientId);
  const categories = Array.from(new Set(services.filter((s) => s.active).map((s) => s.category)));
  const canSave = canSaveDraft(ev, draft.allowOutsideHours);
  const inputCls = 'rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] text-ink-900 focus:border-plum-600';

  return (
    <Modal onClose={close} maxWidth={560} labelledBy="appt-modal-title">
      <ModalTitle id="appt-modal-title">{editing ? 'Reschedule Appointment' : 'New Appointment'}</ModalTitle>
      <div className="flex flex-col gap-5">
        {editing ? (
          <div className="rounded-xl border border-ivory-400 bg-ivory-100 px-4 py-3 text-[13px] text-ink-700">
            <div className="font-bold text-ink-900">{client?.name ?? 'Deleted client'}</div>
            <div>{serviceNames({ services }, editing.serviceIds)} · {formatDuration(editing.durationMin)} · {cur}{ev.total.toFixed(2)}</div>
            <div className="mt-0.5 text-[12px] text-ink-400">Currently {formatDateLong(editing.date)}, {formatTime(editing.time)}. Price and deposit stay the same.</div>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Client
              <select value={draft.clientId} onChange={(e) => update('clientId', e.target.value)} className={inputCls}>
                <option value="">Select a client…</option>
                {bookableClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                ))}
              </select>
              {client && <span className="text-[11.5px] font-normal text-ink-400">{client.visits} visits · Lifetime {cur}{client.lifetimeSpend.toFixed(0)}{client.beautyProfile.allergies && client.beautyProfile.allergies !== 'None known' ? ` · ⚠ ${client.beautyProfile.allergies}` : ''}</span>}
              {bookableClients.length === 0 && <span className="text-[11.5px] font-normal text-ink-400">Add a client first (Quick add → New Client).</span>}
            </label>

            <div>
              <div className="mb-2 text-[12.5px] font-bold text-ink-500">Services</div>
              <div className="flex max-h-[220px] flex-col gap-3 overflow-y-auto rounded-[12px] border border-ivory-400 p-3">
                {categories.length === 0 && <p className="text-[12.5px] text-ink-400">No active services. Add one in Money → Pricing.</p>}
                {categories.map((cat) => (
                  <div key={cat}>
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{cat}</div>
                    <div className="flex flex-col gap-1">
                      {services.filter((sv) => sv.category === cat && sv.active).map((sv) => {
                        const checked = draft.serviceIds.includes(sv.id);
                        return (
                          <button
                            key={sv.id}
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggleService(sv.id)}
                            className={`flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] ${checked ? 'bg-plum-50' : 'hover:bg-ivory-100'}`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border-2 ${checked ? 'border-plum-600 bg-plum-600 text-white' : 'border-ivory-500'}`}>
                                {checked && <Icon name="check" size={11} />}
                              </span>
                              <span className="truncate font-semibold text-ink-900">{sv.name}</span>
                              <span className="flex-none text-[11.5px] text-ink-400">{formatDuration(sv.duration)}</span>
                            </span>
                            <span className="flex-none font-semibold text-ink-700">{cur}{sv.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <div className="mb-2 text-[12.5px] font-bold text-ink-500">Staff</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Staff">
            {staff.map((st) => (
              <button
                key={st.id}
                type="button"
                role="radio"
                aria-checked={draft.staffId === st.id}
                onClick={() => update('staffId', st.id)}
                className={`min-h-[36px] rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${draft.staffId === st.id ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Date
            <input type="date" min={todayISO()} value={draft.date} onChange={(e) => update('date', e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Time
            <input type="time" step={300} value={draft.time} onChange={(e) => update('time', e.target.value)} className={inputCls} />
          </label>
        </div>

        {draft.staffId && draft.date && (
          <div className="rounded-xl border border-ivory-400 bg-ivory-100 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-500"><Icon name="sparkles" size={13} className="text-plum-600" /> Open times · {formatDuration(ev.duration || 30)} needed · {business.hours}</div>
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((t) => (
                  <button key={t} type="button" onClick={() => update('time', t)} className={`min-h-[34px] rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${draft.time === t ? 'border-plum-600 bg-plum-600 text-white' : 'border-ivory-400 bg-white text-ink-700 hover:border-plum-600'}`}>
                    {formatTime(t)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[12.5px] text-ink-500">No open slots that fit on this day — try another date or staff member.</div>
            )}
          </div>
        )}

        {ev.blocking.length > 0 && (draft.clientId || editing) && (draft.serviceIds.length > 0 || editing) && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-bad-100 bg-bad-100/60 p-3">
            <Icon name="alert" size={16} className="mt-0.5 flex-none text-bad-600" />
            <div className="text-[12.5px] leading-relaxed text-bad-600">
              {ev.blocking.map((b) => (
                <div key={b}>{b}</div>
              ))}
            </div>
          </div>
        )}

        {ev.hoursIssue && (
          <div className="rounded-xl border border-warn-100 bg-warn-100/50 p-3 text-[12.5px] text-warn-600">
            <div className="mb-1.5 flex items-center gap-1.5 font-bold"><Icon name="alert" size={14} /> Outside business hours: {ev.hoursIssue}</div>
            <label className="flex min-h-[32px] cursor-pointer items-center gap-2 font-semibold text-ink-700">
              <input type="checkbox" checked={draft.allowOutsideHours} onChange={(e) => update('allowOutsideHours', e.target.checked)} className="h-4 w-4 accent-[var(--color-plum-600)]" />
              Book outside hours anyway
            </label>
          </div>
        )}

        {ev.warnings.length > 0 && ev.blocking.length === 0 && (
          <div className="rounded-xl border border-ivory-400 bg-ivory-100 p-3 text-[12px] text-ink-500">
            {ev.warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}

        {!editing && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
                <div className="text-[11px] text-ink-400">Duration</div>
                <div className="text-[14px] font-bold text-ink-900">{formatDuration(ev.duration)}</div>
              </div>
              <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
                <div className="text-[11px] text-ink-400">Subtotal</div>
                <div className="text-[14px] font-bold text-ink-900">{cur}{ev.price.toFixed(2)}</div>
              </div>
              <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
                <div className="text-[11px] text-ink-400">Total</div>
                <div className="text-[14px] font-bold text-plum-600">{cur}{ev.total.toFixed(2)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
                Discount ({cur})
                <input type="number" inputMode="decimal" min={0} max={ev.price} value={draft.discount || ''} onChange={(e) => update('discount', Number(e.target.value))} className={inputCls} placeholder="0" />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
                Deposit paid now ({cur})
                <div className="flex gap-1.5">
                  <input type="number" inputMode="decimal" min={0} max={ev.total} value={draft.deposit || ''} onChange={(e) => update('deposit', Number(e.target.value))} className={`w-full ${inputCls}`} placeholder="0" />
                  <button
                    type="button"
                    onClick={() => update('deposit', Math.round(ev.total * (business.depositPct / 100) * 100) / 100)}
                    className="flex-none rounded-[10px] border border-ivory-400 px-2.5 text-[11px] font-bold text-ink-500 hover:border-plum-600 hover:text-plum-600"
                    aria-label={`Set deposit to ${business.depositPct}% of total`}
                  >
                    {business.depositPct}%
                  </button>
                </div>
              </label>
            </div>
            {draft.deposit > 0 && (
              <div className="-mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-400">
                <span>Balance due at checkout: {cur}{ev.balance.toFixed(2)}</span>
                <span className="flex gap-1">
                  {(['Card', 'Cash'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => update('depositMethod', m)} className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${draft.depositMethod === m ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}>
                      Deposit by {m}
                    </button>
                  ))}
                </span>
              </div>
            )}

            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Repeats
              <select value={draft.recurring} onChange={(e) => update('recurring', e.target.value as typeof draft.recurring)} className={inputCls}>
                <option value="none">Does not repeat</option>
                <option value="weekly">Weekly (next 12 weeks)</option>
                <option value="biweekly">Every 2 weeks (next 12 weeks)</option>
                <option value="monthly">Monthly (next 3 months)</option>
              </select>
              {draft.recurring !== 'none' && <span className="text-[11.5px] font-normal text-ink-400">Repeats that clash with another booking or fall on a closed day are skipped.</span>}
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Notes
          <textarea value={draft.notes} onChange={(e) => update('notes', e.target.value)} rows={2} className={`resize-none ${inputCls}`} placeholder="Formula notes, requests…" />
        </label>
      </div>
      <div className="sticky -bottom-5 -mx-5 mt-6 flex justify-end gap-2 border-t border-ivory-300 bg-white px-5 py-4 sm:-bottom-6 sm:-mx-6 sm:px-6">
        <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700">Cancel</button>
        <button type="button" onClick={save} aria-disabled={!canSave} className={`min-h-[44px] rounded-lg px-5 py-2.5 text-sm font-bold text-white ${canSave ? 'bg-plum-600 hover:bg-plum-700' : 'cursor-not-allowed bg-plum-600/40'}`}>
          {editing ? 'Save New Time' : 'Confirm Appointment'}
        </button>
      </div>
    </Modal>
  );
}
