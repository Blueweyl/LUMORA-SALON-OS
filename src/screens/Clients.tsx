import { useState } from 'react';
import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { formatDateShort } from '../lib/dates';
import { clientMatches, getNextApptForClient, getOutstandingForClient } from '../lib/selectors';
import { TIER_COLORS, TIER_LABEL } from '../lib/loyalty';
import { ClientProfile } from './ClientProfile';

export function Clients() {
  const selectedClientId = useStore((s) => s.selectedClientId);
  if (selectedClientId) return <ClientProfile />;
  return <ClientsList />;
}

function ClientsList() {
  const state = useStore((s) => s);
  const { clients, search, business, showArchivedClients } = state;
  const setSearch = useStore((s) => s.setSearch);
  const openClient = useStore((s) => s.openClient);
  const openNewClient = useStore((s) => s.openNewClient);
  const setShowArchived = useStore((s) => s.setShowArchivedClients);
  const [limit, setLimit] = useState(100);

  const q = search.trim().toLowerCase();
  const archivedCount = clients.filter((c) => c.archived).length;
  const visible = clients.filter((c) => (showArchivedClients ? c.archived : !c.archived));
  const filtered = (q ? visible.filter((c) => clientMatches(c, q)) : visible).slice().sort((a, b) => a.name.localeCompare(b.name));
  const shown = filtered.slice(0, limit);

  return (
    <div className="mx-auto max-w-[1100px] animate-lum-fade">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-serif text-[28px] font-medium text-ink-900">{showArchivedClients ? 'Archived Clients' : 'Clients'}</h1>
          <p className="text-[14px] text-ink-500">
            {filtered.length} client{filtered.length === 1 ? '' : 's'}
            {archivedCount > 0 && (
              <button onClick={() => setShowArchived(!showArchivedClients)} className="ml-2 min-h-[32px] font-semibold text-plum-600">
                {showArchivedClients ? '← Back to active clients' : `· ${archivedCount} archived`}
              </button>
            )}
          </p>
        </div>
        {!showArchivedClients && <button onClick={openNewClient} className="min-h-[44px] rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-plum-700">+ New Client</button>}
      </div>

      <div className="mb-4 md:hidden">
        <input type="search" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or email…" className="w-full rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="hidden grid-cols-[2fr_1.3fr_1fr_1fr_1fr_0.9fr] gap-2 border-b border-ivory-400 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-400 md:grid">
          <span>Client</span><span>Phone</span><span>Last Visit</span><span>Next Visit</span><span>Lifetime</span><span>Status</span>
        </div>
        {shown.map((c) => {
          const owed = getOutstandingForClient(state, c.id);
          const next = getNextApptForClient(state, c.id);
          const tierColors = TIER_COLORS[c.vipTier];
          return (
            <button key={c.id} onClick={() => openClient(c.id)} className="grid w-full grid-cols-2 items-center gap-x-2 gap-y-1 border-b border-ivory-200 px-5 py-3.5 text-left last:border-0 hover:bg-ivory-100 md:grid-cols-[2fr_1.3fr_1fr_1fr_1fr_0.9fr]">
              <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                <span className="truncate text-[13.5px] font-bold text-ink-900">{c.name}</span>
                {c.vipTier !== 'none' && (
                  <span className="flex-none rounded-full px-2 py-[2px] text-[10px] font-bold" style={{ background: tierColors.bg, color: tierColors.text }}>{TIER_LABEL[c.vipTier]}</span>
                )}
              </span>
              <span className="truncate text-[13px] text-ink-500">{c.phone || '—'}</span>
              <span className="text-[13px] text-ink-500"><span className="md:hidden">Last: </span>{formatDateShort(c.lastVisit)}</span>
              <span className="text-[13px] text-ink-500"><span className="md:hidden">Next: </span>{next ? formatDateShort(next.date) : '—'}</span>
              <span className="text-[13px] font-semibold text-ink-900">{business.currencySymbol}{c.lifetimeSpend.toFixed(0)}</span>
              <span className="text-[13px] font-semibold" style={{ color: owed > 0 ? 'var(--color-bad-600)' : 'var(--color-good-600)' }}>{owed > 0 ? `${business.currencySymbol}${owed.toFixed(0)} due` : 'Paid up'}</span>
            </button>
          );
        })}
        {filtered.length > shown.length && (
          <button onClick={() => setLimit(limit + 200)} className="min-h-[48px] w-full border-t border-ivory-200 text-[13px] font-bold text-plum-600">
            Show more ({filtered.length - shown.length} more)
          </button>
        )}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            {q ? (
              <>
                <div className="mb-1.5 text-[14px] font-bold text-ink-900">No clients match “{search}”</div>
                <p className="mb-4 text-[13px] text-ink-400">Try a different name, phone number or email{archivedCount > 0 && !showArchivedClients ? ', or check archived clients' : ''}.</p>
                <button onClick={() => setSearch('')} className="min-h-[44px] rounded-[9px] border border-ivory-400 px-4 py-2.5 text-[13px] font-bold text-ink-700">Clear Search</button>
              </>
            ) : showArchivedClients ? (
              <div className="text-[13px] text-ink-400">No archived clients.</div>
            ) : (
              <>
                <div className="mb-1.5 text-[14px] font-bold text-ink-900">No clients yet</div>
                <p className="mb-4 text-[13px] text-ink-400">Add your first client to start booking.</p>
                <button onClick={openNewClient} className="min-h-[44px] rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">+ New Client</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div className="flex flex-none items-center justify-center rounded-full bg-plum-100 font-bold text-plum-600" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
    </div>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-ink-400 hover:text-plum-600">
      <Icon name="chevron-left" size={15} /> {label}
    </button>
  );
}
