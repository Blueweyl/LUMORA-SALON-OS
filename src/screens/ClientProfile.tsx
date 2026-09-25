import { useState } from 'react';
import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { ClientAvatar, BackButton } from './Clients';
import { formatDateLong, formatDateShort, formatRelative, formatBirthday, formatTime } from '../lib/dates';
import { getNextApptForClient, getOutstandingAppointments, getOutstandingForClient, serviceNames, apptTotal, staffName } from '../lib/selectors';
import { TIER_COLORS, TIER_LABEL } from '../lib/loyalty';
import { statusMeta } from '../lib/status';
import { paymentLabel } from '../lib/finance';
import type { ClientTab } from '../store/types';
import type { BeautyProfile } from '../types';

const TABS: ClientTab[] = ['Overview', 'History', 'Beauty Profile', 'Photos', 'Notes', 'Payments'];

export function ClientProfile() {
  const state = useStore((s) => s);
  const clientId = useStore((s) => s.selectedClientId)!;
  const tab = useStore((s) => s.clientTab);
  const setTab = useStore((s) => s.setClientTab);
  const close = useStore((s) => s.closeClientProfile);
  const openNewAppt = useStore((s) => s.openNewAppt);
  const openRecordPayment = useStore((s) => s.openRecordPayment);
  const deleteClient = useStore((s) => s.deleteClient);
  const archiveClient = useStore((s) => s.archiveClient);
  const restoreClient = useStore((s) => s.restoreClient);
  const [editing, setEditing] = useState(false);

  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return null;

  const owed = getOutstandingForClient(state, clientId);
  const tierColors = TIER_COLORS[client.vipTier];
  const hasHistory = state.appointments.some((a) => a.clientId === clientId) || state.payments.some((p) => p.clientId === clientId);

  return (
    <div className="mx-auto max-w-[900px] animate-lum-fade">
      <BackButton onClick={close} label="All Clients" />

      {client.archived && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ivory-400 bg-ivory-200 px-4 py-3 text-[13px] text-ink-700">
          <span className="min-w-0 flex-1"><b>Archived.</b> Hidden from your client list and booking; history and payments are kept.</span>
          <button onClick={() => restoreClient(client.id)} className="min-h-[40px] rounded-lg bg-plum-600 px-3.5 text-[12.5px] font-bold text-white">Restore Client</button>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-ivory-400 bg-white p-6 sm:flex-row sm:items-center">
        <ClientAvatar name={client.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-[24px] font-medium text-ink-900">{client.name}</h1>
            {client.vipTier !== 'none' && (
              <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: tierColors.bg, color: tierColors.text }}>{TIER_LABEL[client.vipTier]}</span>
            )}
          </div>
          {editing ? (
            <ContactEditor clientId={client.id} onDone={() => setEditing(false)} />
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
              {client.phone ? <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 hover:text-plum-600"><Icon name="phone" size={12} />{client.phone}</a> : <span className="flex items-center gap-1.5"><Icon name="phone" size={12} />No phone on file</span>}
              {client.email ? <a href={`mailto:${client.email}`} className="flex min-w-0 items-center gap-1.5 break-all hover:text-plum-600"><Icon name="mail" size={12} />{client.email}</a> : <span className="flex items-center gap-1.5"><Icon name="mail" size={12} />No email on file</span>}
              {client.birthday && <span className="flex items-center gap-1.5"><Icon name="gift" size={12} />{formatBirthday(client.birthday)}</span>}
              <button onClick={() => setEditing(true)} className="flex min-h-[32px] items-center gap-1 font-semibold text-plum-600"><Icon name="edit" size={12} /> Edit</button>
            </div>
          )}
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          <button onClick={() => openRecordPayment(client.id)} className="min-h-[44px] rounded-[9px] border border-ivory-400 px-3.5 py-2.5 text-[13px] font-bold text-ink-700 hover:border-plum-600 hover:text-plum-600">Record Payment</button>
          <button onClick={() => (client.archived ? restoreClient(client.id) : openNewAppt({ clientId: client.id }))} className="min-h-[44px] rounded-[9px] bg-plum-600 px-3.5 py-2.5 text-[13px] font-bold text-white hover:bg-plum-700">{client.archived ? 'Restore to Book' : 'Book Appointment'}</button>
        </div>
      </div>

      {owed > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-bad-100 bg-bad-100/50 px-4 py-3 text-[13px] font-semibold text-bad-600">
          <Icon name="alert" size={15} /> <span className="flex-1">{client.name.split(' ')[0]} owes {state.business.currencySymbol}{owed.toFixed(2)}</span>
          <button onClick={() => openRecordPayment(client.id, getOutstandingAppointments(state, client.id)[0]?.id)} className="min-h-[36px] rounded-lg bg-bad-500 px-3 text-[12px] font-bold text-white">Record Payment</button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Visits" value={String(client.visits)} />
        <Metric label="Lifetime spend" value={`${state.business.currencySymbol}${client.lifetimeSpend.toFixed(0)}`} />
        <Metric label="Avg ticket" value={`${state.business.currencySymbol}${client.visits ? (client.lifetimeSpend / client.visits).toFixed(0) : '0'}`} />
        <Metric label="Last visit" value={formatRelative(client.lastVisit)} />
        <Metric label="Loyalty points" value={String(client.loyaltyPoints)} />
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ivory-400">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`mr-5 flex-none border-b-2 pb-2.5 text-[13.5px] font-bold whitespace-nowrap ${tab === t ? 'border-plum-600 text-plum-600' : 'border-transparent text-ink-400'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab clientId={clientId} />}
      {tab === 'History' && <HistoryTab clientId={clientId} />}
      {tab === 'Beauty Profile' && <BeautyProfileTab clientId={clientId} />}
      {tab === 'Photos' && <PhotosTab clientId={clientId} />}
      {tab === 'Notes' && <NotesTab clientId={clientId} />}
      {tab === 'Payments' && <PaymentsTab clientId={clientId} />}

      <div className="mt-8 flex justify-end gap-4">
        {!client.archived && (
          <button onClick={() => archiveClient(clientId)} className="flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-semibold text-ink-400 hover:text-bad-500">
            <Icon name="box" size={12} /> Archive client
          </button>
        )}
        {!hasHistory && (
          <button onClick={() => deleteClient(clientId)} className="flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-semibold text-ink-300 hover:text-bad-500">
            <Icon name="trash" size={12} /> Delete permanently
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-ivory-400 bg-white px-4 py-3.5">
      <div className="mb-1 text-[11px] text-ink-400">{label}</div>
      <div className="font-serif text-[18px] font-bold text-ink-900">{value}</div>
    </div>
  );
}

function OverviewTab({ clientId }: { clientId: string }) {
  const state = useStore((s) => s);
  const client = state.clients.find((c) => c.id === clientId)!;
  const upcoming = getNextApptForClient(state, clientId);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const rebookClient = useStore((s) => s.rebookClient);
  const bp = client.beautyProfile;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-ivory-400 bg-white p-5">
        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Next Appointment</div>
        {upcoming ? (
          <button onClick={() => openApptDetail(upcoming.id)} className="block w-full text-left">
            <div className="text-[14.5px] font-bold text-ink-900">{formatDateLong(upcoming.date)}, {formatTime(upcoming.time)}</div>
            <div className="text-[13px] text-ink-500">{serviceNames(state, upcoming.serviceIds)} · {staffName(state, upcoming.staffId)} · {state.business.currencySymbol}{apptTotal(upcoming).toFixed(0)}</div>
          </button>
        ) : (
          <div>
            <p className="mb-3 text-[13px] text-ink-400">No upcoming appointment booked.{client.lastVisit ? ` Last visit ${formatRelative(client.lastVisit).toLowerCase()}.` : ''}</p>
            {!client.archived && <button onClick={() => rebookClient(clientId)} className="min-h-[40px] rounded-lg bg-plum-600 px-3.5 text-[12.5px] font-bold text-white">Rebook {client.name.split(' ')[0]}</button>}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-ivory-400 bg-white p-5">
        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">At a Glance</div>
        <div className="flex flex-col gap-1.5 text-[13px] text-ink-700">
          {bp.hairType && <div><b className="text-ink-500">Hair:</b> {bp.hairType}</div>}
          {bp.nailType && <div><b className="text-ink-500">Nails:</b> {bp.nailType}</div>}
          {bp.allergies && <div><b className="text-ink-500">Allergies:</b> {bp.allergies}</div>}
          {bp.preferredStaffId && <div><b className="text-ink-500">Prefers:</b> {staffName(state, bp.preferredStaffId)}</div>}
          {!bp.hairType && !bp.nailType && !bp.allergies && <p className="text-ink-400">No beauty profile details yet.</p>}
        </div>
      </div>
      {(client.noShowCount > 0 || client.cancellationCount > 0) && (
        <div className="rounded-2xl border border-ivory-400 bg-white p-5 md:col-span-2">
          <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Attendance</div>
          <p className="text-[13px] text-ink-500">{client.noShowCount} no-show{client.noShowCount === 1 ? '' : 's'} · {client.cancellationCount} cancellation{client.cancellationCount === 1 ? '' : 's'} on record.</p>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ clientId }: { clientId: string }) {
  const state = useStore((s) => s);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const history = state.appointments.filter((a) => a.clientId === clientId).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  if (history.length === 0) return <EmptyState text="No appointment history yet." />;

  return (
    <div className="flex flex-col gap-2">
      {history.map((a) => {
        const meta = statusMeta(a.status);
        return (
          <button key={a.id} onClick={() => openApptDetail(a.id)} className="flex items-center justify-between gap-3 rounded-xl border border-ivory-400 bg-white px-4 py-3 text-left hover:border-plum-600">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-bold text-ink-900">{serviceNames(state, a.serviceIds)}</div>
              <div className="text-[12px] text-ink-400">{formatDateShort(a.date)} · {formatTime(a.time)} · {staffName(state, a.staffId)}</div>
            </div>
            <div className="flex flex-none items-center gap-3">
              <span className="hidden text-[13.5px] font-bold text-ink-900 sm:inline">{state.business.currencySymbol}{apptTotal(a).toFixed(0)}</span>
              <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const BP_FIELDS: { key: keyof BeautyProfile; label: string; placeholder: string }[] = [
  { key: 'hairType', label: 'Hair type', placeholder: 'e.g. Fine, low-porosity, level 6' },
  { key: 'skinType', label: 'Skin type', placeholder: 'e.g. Combination, sensitive' },
  { key: 'nailType', label: 'Nail type', placeholder: 'e.g. Natural, prone to breakage' },
  { key: 'allergies', label: 'Allergies / sensitivities', placeholder: 'None known' },
  { key: 'formulas', label: 'Formulas / color history', placeholder: 'e.g. Blondor 20vol + T18 toner' },
  { key: 'productsUsed', label: 'Products used', placeholder: 'e.g. Kerastase Elixir Ultime' },
  { key: 'patchTestDate', label: 'Last patch test', placeholder: 'YYYY-MM-DD' },
  { key: 'preferences', label: 'Service preferences', placeholder: 'e.g. Prefers low heat, soft layers' },
];

function BeautyProfileTab({ clientId }: { clientId: string }) {
  const state = useStore((s) => s);
  const client = state.clients.find((c) => c.id === clientId)!;
  const update = useStore((s) => s.updateBeautyProfileField);

  return (
    <div className="rounded-2xl border border-ivory-400 bg-white p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {BP_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5 text-[12px] font-bold text-ink-500">
            {f.label}
            <input
              value={client.beautyProfile[f.key]}
              onChange={(e) => update(clientId, f.key, e.target.value)}
              placeholder={f.placeholder}
              className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[13.5px] font-normal text-ink-900"
            />
          </label>
        ))}
        <label className="flex flex-col gap-1.5 text-[12px] font-bold text-ink-500">
          Preferred staff
          <select value={client.beautyProfile.preferredStaffId} onChange={(e) => update(clientId, 'preferredStaffId', e.target.value)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[13.5px] font-normal">
            <option value="">No preference</option>
            {state.staff.filter((s) => !s.archived || s.id === client.beautyProfile.preferredStaffId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function PhotosTab({ clientId }: { clientId: string }) {
  const state = useStore((s) => s);
  const client = state.clients.find((c) => c.id === clientId)!;
  const addPhoto = useStore((s) => s.addClientPhoto);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => addPhoto(clientId, 'Before', 'before')} className="flex items-center gap-1.5 rounded-[9px] border border-dashed border-ivory-500 px-3.5 py-2 text-[12.5px] font-bold text-plum-600">
          <Icon name="camera" size={14} /> Add Before Photo
        </button>
        <button onClick={() => addPhoto(clientId, 'After', 'after')} className="flex items-center gap-1.5 rounded-[9px] border border-dashed border-ivory-500 px-3.5 py-2 text-[12.5px] font-bold text-plum-600">
          <Icon name="camera" size={14} /> Add After Photo
        </button>
      </div>
      {client.photos.length === 0 ? (
        <EmptyState text="No photos yet. Add a before/after to build their visual history." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {client.photos.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-ivory-400">
              <div className="flex h-28 items-center justify-center text-[11px] font-bold text-white/90" style={{ background: p.color }}>{p.kind.toUpperCase()}</div>
              <div className="p-2">
                <div className="text-[12px] font-semibold text-ink-900">{p.label}</div>
                <div className="text-[11px] text-ink-400">{formatDateShort(p.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesTab({ clientId }: { clientId: string }) {
  const state = useStore((s) => s);
  const client = state.clients.find((c) => c.id === clientId)!;
  const addNote = useStore((s) => s.addClientNote);
  const [draft, setDraft] = useState('');

  return (
    <div>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { addNote(clientId, draft); setDraft(''); } }}>
        <input aria-label="New note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note…" className="min-w-0 flex-1 rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[13.5px]" />
        <button
          type="submit"
          className="flex-none rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-plum-700"
        >
          Add Note
        </button>
      </form>
      {client.notes.length === 0 ? (
        <EmptyState text="No notes yet." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {client.notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-ivory-400 bg-white p-3.5">
              <p className="text-[13.5px] leading-relaxed text-ink-800">{n.text}</p>
              <div className="mt-1.5 text-[11.5px] text-ink-400">{formatDateShort(n.date)} · {n.author}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ clientId }: { clientId: string }) {
  const state = useStore((s) => s);
  const voidPayment = useStore((s) => s.voidPayment);
  const cur = state.business.currencySymbol;
  const client = state.clients.find((c) => c.id === clientId);
  const payments = state.payments.filter((p) => p.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const cards = state.giftCards.filter((c) => c.clientId === clientId && !c.voided && c.balance > 0);
  const log = client?.pointsLog || [];

  return (
    <div className="flex flex-col gap-5">
      {cards.length > 0 && (
        <div className="rounded-xl border border-good-100 bg-good-100/40 px-4 py-3 text-[13px] text-good-600">
          <b>Store credit &amp; gift cards: {cur}{cards.reduce((sum, c) => sum + c.balance, 0).toFixed(2)}</b>
          <span className="text-ink-500"> — {cards.map((c) => `${c.code} (${cur}${c.balance.toFixed(2)})`).join(', ')}. Choose it at checkout to use it.</span>
        </div>
      )}
      {payments.length === 0 ? (
        <EmptyState text="No payments recorded yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 rounded-xl border border-ivory-400 bg-white px-4 py-3 ${p.voided ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold capitalize text-ink-900">{paymentLabel(p)}{p.voided ? ' · voided' : ''}</div>
                <div className="text-[12px] text-ink-400">{formatDateShort(p.date)} · {p.method}{p.tip ? ` · incl. ${cur}${p.tip.toFixed(2)} tip` : ''}{p.note ? ` · ${p.note}` : ''}</div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className={`text-[14px] font-bold ${p.voided ? 'text-ink-400 line-through' : p.method === 'Gift card' ? 'text-ink-500' : 'text-good-600'}`}>{p.method === 'Gift card' ? '' : '+'}{cur}{p.amount.toFixed(2)}</span>
                {!p.voided && <button onClick={() => voidPayment(p.id)} className="min-h-[32px] rounded-md border border-ivory-300 px-2 text-[11px] font-semibold text-ink-400 hover:border-bad-500 hover:text-bad-500">Void</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Loyalty points history · {client?.loyaltyPoints ?? 0} pts now</div>
        {log.length === 0 ? (
          <div className="text-[12.5px] text-ink-400">Points earned at checkout and rewards redeemed are listed here.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-ivory-400 bg-white">
            {log.slice(0, 50).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-t border-ivory-200 px-4 py-2.5 text-[13px] first:border-t-0">
                <span className="min-w-0 truncate text-ink-700">{e.reason} <span className="text-ink-400">· {formatDateShort(e.date)}</span></span>
                <span className={`flex-none font-bold ${e.delta >= 0 ? 'text-good-600' : 'text-bad-600'}`}>{e.delta >= 0 ? '+' : '−'}{Math.abs(e.delta)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-ivory-400 py-10 text-center text-[13px] text-ink-400">{text}</div>;
}

function ContactEditor({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const client = useStore((s) => s.clients.find((c) => c.id === clientId));
  const saveContact = useStore((s) => s.saveClientContact);
  const [form, setForm] = useState({ name: client?.name ?? '', phone: client?.phone ?? '', email: client?.email ?? '', birthday: client?.birthday ?? '' });
  if (!client) return null;
  const inputCls = 'min-w-0 rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px] text-ink-900';
  return (
    <form
      className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        saveContact(clientId, form, onDone);
      }}
    >
      <input aria-label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
      <input aria-label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={inputCls} />
      <input aria-label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={inputCls} />
      <input aria-label="Birthday" type="date" value={form.birthday ? `2000-${form.birthday}` : ''} onChange={(e) => setForm({ ...form, birthday: e.target.value.slice(5) })} className={inputCls} />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="min-h-[40px] rounded-lg bg-plum-600 px-3.5 text-[12.5px] font-bold text-white">Save</button>
        <button type="button" onClick={onDone} className="min-h-[40px] rounded-lg border border-ivory-400 px-3.5 text-[12.5px] font-semibold text-ink-700">Cancel</button>
      </div>
    </form>
  );
}
