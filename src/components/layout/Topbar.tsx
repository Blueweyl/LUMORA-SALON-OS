import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../icons';
import { QuickAddMenu } from './QuickAddMenu';
import { clientName, getSearchResults, serviceNames, staffName } from '../../lib/selectors';
import { formatDateShort, formatTime } from '../../lib/dates';
import { isBackupStale, useStorageStatus } from '../../lib/storage';

interface ResultItem {
  key: string;
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  detail: string;
  group: string;
  run: () => void;
}

export function Topbar() {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const openClient = useStore((s) => s.openClient);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const setSection = useStore((s) => s.setSection);
  const setMoneyTab = useStore((s) => s.setMoneyTab);
  const setPricingServiceId = useStore((s) => s.setPricingServiceId);
  const setStaffFilter = useStore((s) => s.setStaffFilter);
  const setBookingsView = useStore((s) => s.setBookingsView);
  const setBookingsDate = useStore((s) => s.setBookingsDate);
  const askResetDemo = useStore((s) => s.askResetDemo);
  const openSettings = useStore((s) => s.openSettings);
  const toggleSidebarMobile = useStore((s) => s.toggleSidebarMobile);
  const demoMode = useStore((s) => s.demoMode);
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const clientCount = useStore((s) => s.clients.length);
  const clients = useStore((s) => s.clients);
  const appointments = useStore((s) => s.appointments);
  const payments = useStore((s) => s.payments);
  const services = useStore((s) => s.services);
  const staff = useStore((s) => s.staff);
  const business = useStore((s) => s.business);
  const storage = useStorageStatus();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  const items = useMemo<ResultItem[]>(() => {
    const st = { clients, appointments, payments, services, staff, business, inventory: [], expenses: [], waitlist: [], loyaltyRewards: [] };
    const r = getSearchResults(st, search);
    const cur = business.currencySymbol;
    const out: ResultItem[] = [];
    r.clients.forEach((c) => out.push({ key: `c_${c.id}`, icon: 'clients', group: 'Clients', title: `${c.name}${c.archived ? ' (archived)' : ''}`, detail: [c.phone, c.email].filter(Boolean).join(' · '), run: () => openClient(c.id) }));
    r.appointments.forEach((a) =>
      out.push({ key: `a_${a.id}`, icon: 'calendar', group: 'Bookings', title: clientName(st, a.clientId), detail: `${serviceNames(st, a.serviceIds)} · ${formatDateShort(a.date)} ${formatTime(a.time)} · ${a.status}`, run: () => { setSection('bookings'); setBookingsDate(a.date); openApptDetail(a.id); } }),
    );
    r.services.forEach((sv) => out.push({ key: `s_${sv.id}`, icon: 'sparkles', group: 'Services', title: `${sv.name}${sv.active ? '' : ' (archived)'}`, detail: `${sv.category} · ${cur}${sv.price}`, run: () => { setSection('money'); setMoneyTab('Pricing'); setPricingServiceId(sv.id); } }));
    r.staff.forEach((m) => out.push({ key: `t_${m.id}`, icon: 'user-plus', group: 'Team', title: staffName(st, m.id), detail: m.role, run: () => { setSection('bookings'); setBookingsView('Agenda'); if (!m.archived) setStaffFilter(m.id); } }));
    r.payments.forEach((p) =>
      out.push({ key: `p_${p.id}`, icon: 'dollar-sign', group: 'Payments', title: `${cur}${p.amount.toFixed(2)} · ${clientName(st, p.clientId)}${p.voided ? ' (voided)' : ''}`, detail: `${p.type.replace('-', ' ')} · ${p.method} · ${formatDateShort(p.date)}`, run: () => (clients.some((c) => c.id === p.clientId) ? openClient(p.clientId, 'Payments') : (setSection('money'), setMoneyTab('Payments'))) }),
    );
    return out;
  }, [search, clients, appointments, payments, services, staff, business, openClient, openApptDetail, setSection, setMoneyTab, setPricingServiceId, setStaffFilter, setBookingsView, setBookingsDate]);

  const showResults = focused && search.trim().length > 0;
  const choose = (item: ResultItem) => {
    item.run();
    setSearch('');
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const needsBackup = isBackupStale(lastBackupAt, demoMode, clientCount);

  return (
    <header className="sticky top-0 z-50 flex items-center gap-2 border-b border-ivory-400 bg-ivory-50 px-3 py-2.5 sm:gap-3 md:px-6">
      <button className="flex h-10 w-10 flex-none items-center justify-center rounded-lg md:hidden" onClick={toggleSidebarMobile} aria-label="Open menu">
        <span className="block h-[1.5px] w-4 bg-ink-900 shadow-[0_5px_0_var(--color-ink-900),0_-5px_0_var(--color-ink-900)]" />
      </button>
      <div className="hidden font-serif-italic text-[19px] tracking-wide text-plum-600 whitespace-nowrap sm:block">Lumora</div>
      <div className="relative min-w-0 max-w-[420px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><Icon name="search" size={15} /></span>
        <input
          type="search"
          value={search}
          role="combobox"
          aria-expanded={showResults}
          aria-controls="global-search-results"
          aria-activedescendant={showResults && items[active] ? `sr_${items[active].key}` : undefined}
          aria-label="Search clients, phone, email, bookings, services, team and payments"
          onChange={(e) => { setSearch(e.target.value); setActive(0); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === 'Enter' && items[active]) { e.preventDefault(); choose(items[active]); }
            else if (e.key === 'Escape') { setSearch(''); }
          }}
          placeholder="Search clients, phone, bookings…"
          className="w-full rounded-[10px] border border-ivory-400 bg-ivory-100 py-2.5 pl-9 pr-3 text-[14px] text-ink-900 outline-none focus:border-plum-600"
        />
        {showResults && (
          <div id="global-search-results" role="listbox" className="absolute left-0 top-[46px] z-[80] max-h-[70svh] w-[min(420px,calc(100vw-24px))] overflow-y-auto animate-lum-pop rounded-xl border border-ivory-400 bg-white p-1.5 shadow-[var(--shadow-pop)]">
            {items.length === 0 && <div className="px-3 py-3 text-[13px] text-ink-400">No matches for “{search}”. Try a name, phone number, email, service or amount.</div>}
            {items.map((it, i) => (
              <div key={it.key}>
                {(i === 0 || items[i - 1].group !== it.group) && <div className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{it.group}</div>}
                <button
                  id={`sr_${it.key}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); choose(it); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-plum-50' : ''}`}
                >
                  <Icon name={it.icon} size={14} className="flex-none text-plum-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink-900">{it.title}</span>
                    {it.detail && <span className="block truncate text-[11.5px] text-ink-400">{it.detail}</span>}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="hidden flex-1 md:block" />
      <button
        onClick={() => openSettings('Data')}
        className={`hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold md:flex ${storage.saveError ? 'text-bad-600' : 'text-ink-400 hover:text-ink-700'}`}
        title="Your data is saved in this browser on this device"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${storage.saveError ? 'bg-bad-500' : 'animate-lum-pulse bg-good-500'}`} />
        {storage.saveError ? 'Not saved' : 'Saved on this device'}
      </button>
      {needsBackup && (
        <button onClick={() => openSettings('Data')} className="flex h-10 flex-none items-center gap-1.5 rounded-lg bg-warn-100 px-2.5 text-[11.5px] font-bold text-warn-600" aria-label="Back up your data">
          <Icon name="download" size={14} /> <span className="hidden sm:inline">{lastBackupAt ? 'Back up' : 'No backup yet'}</span>
        </button>
      )}
      {demoMode && (
        <>
          <div className="hidden rounded-lg bg-warn-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-warn-600 lg:block">DEMO MODE</div>
          <button onClick={askResetDemo} className="hidden rounded-lg border border-ivory-400 px-3 py-1.5 text-[12.5px] font-semibold text-ink-500 hover:border-plum-600 hover:text-plum-600 lg:block">
            Reset Demo
          </button>
        </>
      )}
      <button onClick={() => openSettings()} className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-ivory-400 text-ink-500 hover:border-plum-600 hover:text-plum-600" aria-label="Settings">
        <Icon name="settings" size={17} />
      </button>
      <QuickAddMenu />
    </header>
  );
}
