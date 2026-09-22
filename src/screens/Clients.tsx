import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { formatDateShort } from '../lib/dates';
import { getOutstandingForClient, hasUpcomingAppt } from '../lib/selectors';
import { TIER_COLORS, TIER_LABEL } from '../lib/loyalty';
import { ClientProfile } from './ClientProfile';

export function Clients() {
  const selectedClientId = useStore((s) => s.selectedClientId);
  if (selectedClientId) return <ClientProfile />;
  return <ClientsList />;
}

function ClientsList() {
  const state = useStore((s) => s);
  const { clients, search, business, appointments } = state;
  const setSearch = useStore((s) => s.setSearch);
  const openClient = useStore((s) => s.openClient);
  const openNewClient = useStore((s) => s.openNewClient);

  const q = search.trim().toLowerCase();
  const filtered = q ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)) : clients;

  const nextVisitLabel = (clientId: string) => {
    const upcoming = appointments.filter((a) => a.clientId === clientId && hasUpcomingAppt(state, clientId) && a.status !== 'cancelled' && a.status !== 'completed').sort((a, b) => a.date.localeCompare(b.date))[0];
    return upcoming ? formatDateShort(upcoming.date) : '—';
  };

  return (
    <div className="mx-auto max-w-[1100px] animate-lum-fade">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="mb-1 font-serif text-[28px] font-medium text-ink-900">Clients</h1>
          <p className="text-[14px] text-ink-500">{filtered.length} client{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={openNewClient} className="rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-plum-700">+ New Client</button>
      </div>

      <div className="mb-4 md:hidden">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="w-full rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="hidden grid-cols-[2fr_1.3fr_1fr_1fr_1fr_0.9fr] gap-2 border-b border-ivory-400 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-400 md:grid">
          <span>Client</span><span>Phone</span><span>Last Visit</span><span>Next Visit</span><span>Lifetime</span><span>Status</span>
        </div>
        {filtered.map((c) => {
          const owed = getOutstandingForClient(state, c.id);
          const tierColors = TIER_COLORS[c.vipTier];
          return (
            <button key={c.id} onClick={() => openClient(c.id)} className="grid w-full grid-cols-2 items-center gap-2 border-b border-ivory-200 px-5 py-3.5 text-left last:border-0 hover:bg-ivory-100 md:grid-cols-[2fr_1.3fr_1fr_1fr_1fr_0.9fr]">
              <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                <span className="truncate text-[13.5px] font-bold text-ink-900">{c.name}</span>
                {c.vipTier !== 'none' && (
                  <span className="flex-none rounded-full px-2 py-[2px] text-[10px] font-bold" style={{ background: tierColors.bg, color: tierColors.text }}>{TIER_LABEL[c.vipTier]}</span>
                )}
              </span>
              <span className="text-[13px] text-ink-500">{c.phone}</span>
              <span className="text-[13px] text-ink-500">{formatDateShort(c.lastVisit)}</span>
              <span className="text-[13px] text-ink-500">{nextVisitLabel(c.id)}</span>
              <span className="text-[13px] font-semibold text-ink-900">{business.currencySymbol}{c.lifetimeSpend.toFixed(0)}</span>
              <span className="text-[13px] font-semibold" style={{ color: owed > 0 ? 'var(--color-bad-600)' : 'var(--color-good-600)' }}>{owed > 0 ? `${business.currencySymbol}${owed.toFixed(0)} due` : 'Paid up'}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="mb-1.5 text-[14px] font-bold text-ink-900">No clients match "{search}"</div>
            <p className="mb-4 text-[13px] text-ink-400">Try a different name, or add this client to your list.</p>
            <button onClick={openNewClient} className="rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">+ New Client</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div className="flex flex-none items-center justify-center rounded-full bg-plum-100 font-bold text-plum-600" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
    </div>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink-400 hover:text-plum-600">
      <Icon name="chevron-left" size={15} /> {label}
    </button>
  );
}
