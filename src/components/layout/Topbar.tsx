import { useState } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../icons';
import { QuickAddMenu } from './QuickAddMenu';
import { getSearchResults, serviceNames } from '../../lib/selectors';
import { formatDateShort, formatTime } from '../../lib/dates';

export function Topbar() {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const openClient = useStore((s) => s.openClient);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const setSection = useStore((s) => s.setSection);
  const askResetDemo = useStore((s) => s.askResetDemo);
  const openSettings = useStore((s) => s.openSettings);
  const toggleSidebarMobile = useStore((s) => s.toggleSidebarMobile);
  const [focused, setFocused] = useState(false);
  const state = useStore((s) => s);
  const results = getSearchResults(state, search);
  const showResults = focused && search.trim().length > 0;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-ivory-400 bg-ivory-50 px-4 py-3 md:px-6">
      <button className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg md:hidden" onClick={toggleSidebarMobile} aria-label="Menu">
        <span className="block h-[1.5px] w-4 bg-ink-900 shadow-[0_5px_0_var(--color-ink-900),0_-5px_0_var(--color-ink-900)]" />
      </button>
      <div className="font-serif-italic text-[19px] tracking-wide text-plum-600 whitespace-nowrap">Lumora</div>
      <div className="relative max-w-[420px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><Icon name="search" size={15} /></span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search clients, appointments…"
          className="w-full rounded-[10px] border border-ivory-400 bg-ivory-100 py-2.5 pl-9 pr-3 text-[13.5px] text-ink-900 outline-none focus:border-plum-600"
        />
        {showResults && (
          <div className="absolute left-0 top-[42px] z-[80] w-full max-w-[380px] animate-lum-pop rounded-xl border border-ivory-400 bg-white p-1.5 shadow-[var(--shadow-pop)]">
            {results.clients.length === 0 && results.appointments.length === 0 && (
              <div className="px-3 py-3 text-[13px] text-ink-400">No matches for "{search}"</div>
            )}
            {results.clients.map((c) => (
              <button key={c.id} onMouseDown={() => { openClient(c.id); setSearch(''); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-plum-50">
                <Icon name="clients" size={14} className="text-plum-600" />
                <span className="text-[13px] font-semibold text-ink-900">{c.name}</span>
                <span className="text-[11.5px] text-ink-400">{c.phone}</span>
              </button>
            ))}
            {results.appointments.map((a) => {
              const c = state.clients.find((cl) => cl.id === a.clientId);
              return (
                <button key={a.id} onMouseDown={() => { setSection('bookings'); openApptDetail(a.id); setSearch(''); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-plum-50">
                  <Icon name="calendar" size={14} className="text-plum-600" />
                  <span className="text-[13px] font-semibold text-ink-900">{c?.name}</span>
                  <span className="text-[11.5px] text-ink-400">{serviceNames(state, a.serviceIds)} · {formatDateShort(a.date)} {formatTime(a.time)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex-1" />
      <div className="hidden items-center gap-1.5 text-[11.5px] font-semibold text-ink-400 md:flex">
        <span className="h-1.5 w-1.5 animate-lum-pulse rounded-full bg-good-500" />
        Autosaved
      </div>
      <div className="hidden rounded-lg bg-warn-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-warn-600 sm:block">DEMO MODE</div>
      <button onClick={askResetDemo} className="hidden rounded-lg border border-ivory-400 px-3 py-1.5 text-[12.5px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600 sm:block">
        Reset Demo
      </button>
      <button onClick={() => openSettings()} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-ivory-400 text-ink-500 hover:border-plum-600 hover:text-plum-600" aria-label="Settings">
        <Icon name="settings" size={17} />
      </button>
      <QuickAddMenu />
    </div>
  );
}
