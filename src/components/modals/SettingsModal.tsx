import { useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';
import { CURRENCIES } from '../../data/seed';
import { WEEK_ORDER, dayShort } from '../../lib/hours';
import { formatBytes, isBackupStale, recoveryInfo, useStorageStatus } from '../../lib/storage';
import { formatRelativeTime } from '../../lib/dates';
import type { SettingsTab } from '../../store/types';

const TABS: SettingsTab[] = ['Business', 'Services', 'Team', 'Booking', 'Loyalty', 'Data'];
const inputCls = 'rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] font-normal text-ink-900';

export function SettingsModal() {
  const show = useStore((s) => s.showSettings);
  const tab = useStore((s) => s.settingsTab);
  const setTab = useStore((s) => s.setSettingsTab);
  const close = useStore((s) => s.closeSettings);
  const setSection = useStore((s) => s.setSection);
  const setMoneyTab = useStore((s) => s.setMoneyTab);
  const setGrowTab = useStore((s) => s.setGrowTab);

  if (!show) return null;

  const goTo = (section: 'money' | 'grow', sub: string) => {
    close();
    setSection(section);
    if (section === 'money') setMoneyTab(sub as Parameters<typeof setMoneyTab>[0]);
    if (section === 'grow') setGrowTab(sub as Parameters<typeof setGrowTab>[0]);
  };

  return (
    <Modal onClose={close} maxWidth={640} labelledBy="settings-title">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="settings-title" className="font-serif text-[22px] font-medium text-ink-900">Settings</h2>
        <button onClick={close} aria-label="Close settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-400 hover:text-ink-900"><Icon name="close" size={18} /></button>
      </div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ivory-400 scrollbar-none" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`mr-4 flex-none border-b-2 pb-2.5 text-[13.5px] font-bold ${tab === t ? 'border-plum-600 text-plum-600' : 'border-transparent text-ink-400'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Business' && <BusinessTab />}

      {tab === 'Services' && (
        <div>
          <p className="mb-3 text-[13.5px] text-ink-500">Services and pricing live in Money to avoid duplicate screens.</p>
          <button onClick={() => goTo('money', 'Pricing')} className="min-h-[44px] rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Manage Services →</button>
        </div>
      )}

      {tab === 'Team' && <TeamTab />}
      {tab === 'Booking' && <BookingTab />}

      {tab === 'Loyalty' && (
        <div>
          <p className="mb-3 text-[13.5px] text-ink-500">Loyalty tiers, points and rewards live in Grow to avoid duplicate screens.</p>
          <button onClick={() => goTo('grow', 'Loyalty')} className="min-h-[44px] rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Manage Loyalty →</button>
        </div>
      )}

      {tab === 'Data' && <DataTab />}
    </Modal>
  );
}

function BusinessTab() {
  const business = useStore((s) => s.business);
  const updateBiz = useStore((s) => s.updateBusinessField);
  const toggleOpenDay = useStore((s) => s.toggleOpenDay);
  const setHours = useStore((s) => s.setBusinessHours);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Business name
        <input value={business.name} onChange={(e) => updateBiz('name', e.target.value)} onBlur={(e) => !e.target.value.trim() && updateBiz('name', 'My Beauty Business')} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Currency
        <select
          value={business.currencyCode}
          onChange={(e) => {
            const c = CURRENCIES.find((cur) => cur.code === e.target.value);
            if (!c) return;
            updateBiz('currencyCode', c.code);
            updateBiz('currencySymbol', c.symbol);
          }}
          className={inputCls}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </label>
      <div>
        <div className="mb-1.5 text-[12.5px] font-bold text-ink-500">Open days</div>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((d) => {
            const on = business.openDays.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => toggleOpenDay(d)} className={`h-10 min-w-[48px] rounded-full border px-3 text-[13px] font-bold ${on ? 'border-plum-600 bg-plum-600 text-white' : 'border-ivory-400 text-ink-500'}`}>
                {dayShort(d)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Opens
          <input type="time" step={900} value={business.openTime} onChange={(e) => setHours(e.target.value, business.closeTime)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
          Closes
          <input type="time" step={900} value={business.closeTime} onChange={(e) => setHours(business.openTime, e.target.value)} className={inputCls} />
        </label>
      </div>
      <p className="-mt-2 text-[12px] text-ink-400">{business.hours}. New bookings outside these hours need an extra confirmation.</p>
    </div>
  );
}

function TeamTab() {
  const staff = useStore((s) => s.staff);
  const addStaff = useStore((s) => s.addStaff);
  const updateStaff = useStore((s) => s.updateStaff);
  const removeStaff = useStore((s) => s.removeStaff);
  const restoreStaff = useStore((s) => s.restoreStaff);
  const [newName, setNewName] = useState('');
  const active = staff.filter((s) => !s.archived);
  const former = staff.filter((s) => s.archived);
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        {active.map((st) => (
          <div key={st.id} className="flex items-center gap-2 rounded-lg border border-ivory-400 p-2.5">
            <input aria-label="Name" value={st.name} onChange={(e) => updateStaff(st.id, 'name', e.target.value)} onBlur={(e) => !e.target.value.trim() && updateStaff(st.id, 'name', 'Team member')} className="min-w-0 flex-1 rounded-md border border-ivory-300 px-2.5 py-2 text-[13px] font-semibold" />
            <input aria-label="Role" value={st.role} onChange={(e) => updateStaff(st.id, 'role', e.target.value)} className="min-w-0 flex-1 rounded-md border border-ivory-300 px-2.5 py-2 text-[13px]" />
            <button onClick={() => removeStaff(st.id)} aria-label={`Remove ${st.name} from the team`} className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-ivory-300 text-ink-400 hover:border-bad-500 hover:text-bad-500"><Icon name="trash" size={13} /></button>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          addStaff(newName.trim(), 'Stylist');
          setNewName('');
        }}
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New team member's name" className={`min-w-0 flex-1 ${inputCls}`} />
        <button type="submit" className="min-h-[44px] flex-none rounded-[10px] border border-dashed border-ivory-500 px-4 text-[13px] font-bold text-plum-600">+ Add</button>
      </form>
      {former.length > 0 && (
        <div className="mt-5">
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Former team members</div>
          <p className="mb-2 text-[12px] text-ink-400">Kept so past appointments and reports still show who did the work.</p>
          {former.map((st) => (
            <div key={st.id} className="flex items-center justify-between border-t border-ivory-200 py-2 text-[13px]">
              <span className="text-ink-500">{st.name} · {st.role}</span>
              <button onClick={() => restoreStaff(st.id)} className="min-h-[34px] rounded-md border border-ivory-400 px-2.5 text-[12px] font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600">Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingTab() {
  const business = useStore((s) => s.business);
  const updateBiz = useStore((s) => s.updateBusinessField);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Default deposit ({business.depositPct}%)
        <input type="range" min={0} max={50} value={business.depositPct} onChange={(e) => updateBiz('depositPct', Number(e.target.value))} className="accent-[var(--color-plum-600)]" />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Buffer between appointments (minutes)
        <input type="number" inputMode="numeric" min={0} max={240} value={business.bufferMin} onChange={(e) => updateBiz('bufferMin', Number(e.target.value))} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Cancellation window (hours)
        <input type="number" inputMode="numeric" min={0} value={business.cancellationWindowHrs} onChange={(e) => updateBiz('cancellationWindowHrs', Number(e.target.value))} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Typical rebook cycle (weeks)
        <input type="number" inputMode="numeric" min={1} max={52} value={business.rebookWeeks} onChange={(e) => updateBiz('rebookWeeks', Number(e.target.value))} className={inputCls} />
        <span className="text-[11.5px] font-normal text-ink-400">Clients show as “due for rebooking” this long after their last visit.</span>
      </label>
    </div>
  );
}

function DataTab() {
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const demoMode = useStore((s) => s.demoMode);
  const exportBackup = useStore((s) => s.exportBackup);
  const beginImport = useStore((s) => s.beginImport);
  const restoreRecovery = useStore((s) => s.restoreRecovery);
  const askResetDemo = useStore((s) => s.askResetDemo);
  const clearAllData = useStore((s) => s.clearAllData);
  const toast = useStore((s) => s.toast);
  const clientCount = useStore((s) => s.clients.length);
  const storage = useStorageStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const recovery = recoveryInfo();

  const importFile = (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast('That file is too large to be a Lumora backup');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => beginImport(file.name, String(reader.result ?? ''));
    reader.onerror = () => toast('That file could not be read');
    reader.readAsText(file);
  };

  const backupStale = isBackupStale(lastBackupAt, demoMode, clientCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-ivory-400 p-4">
        <div className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-ink-900"><Icon name="box" size={14} /> Where your data lives</div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-ink-500">
          Everything is saved automatically <b>on this device, in this browser only</b> — nothing is uploaded. Clearing browser data, using a private window, or switching browsers/devices will not carry it over. Export a backup regularly and keep it somewhere safe.
        </p>
        <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-3">
          <Stat label="Saving" value={storage.saveError ? 'Not saving!' : storage.lastSavedAt ? `Saved ${formatRelativeTime(storage.lastSavedAt)}` : 'Up to date'} bad={Boolean(storage.saveError)} />
          <Stat label="Last backup" value={lastBackupAt ? formatRelativeTime(new Date(lastBackupAt).getTime()) : 'Never'} bad={backupStale} />
          <Stat label="Stored" value={`${clientCount} clients · ${formatBytes(storage.sizeBytes)}`} />
        </div>
        {storage.saveError && <p role="alert" className="mt-3 rounded-lg bg-bad-100/60 px-3 py-2 text-[12.5px] font-semibold text-bad-600">{storage.saveError}</p>}
      </div>

      <div className="rounded-xl border border-ivory-400 p-4">
        <div className="mb-1 text-[13.5px] font-bold text-ink-900">Backup &amp; restore</div>
        <p className="mb-3 text-[12.5px] text-ink-500">A backup is a single file with all your clients, bookings, payments and settings. Restoring shows you what's inside before anything changes, and keeps a recovery copy of your current data.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportBackup} className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-plum-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-plum-700">
            <Icon name="download" size={14} /> Export Backup
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-ivory-400 px-3.5 py-2 text-[12.5px] font-bold text-ink-700 hover:border-plum-600 hover:text-plum-600">
            <Icon name="upload" size={14} /> Restore From Backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {recovery && (
        <div className="rounded-xl border border-ivory-400 p-4">
          <div className="mb-1 text-[13.5px] font-bold text-ink-900">Recovery copy</div>
          <p className="mb-3 text-[12.5px] text-ink-500">Saved {new Date(recovery.createdAt).toLocaleString()} — {recovery.reason.toLowerCase()}. Use it to undo that change.</p>
          <button onClick={restoreRecovery} className="min-h-[44px] rounded-lg border border-ivory-400 px-3.5 py-2 text-[12.5px] font-bold text-ink-700 hover:border-plum-600 hover:text-plum-600">Restore Recovery Copy</button>
        </div>
      )}

      <div className="rounded-xl border border-ivory-400 p-4">
        <div className="mb-1 text-[13.5px] font-bold text-ink-900">{demoMode ? 'Reset demo data' : 'Load the demo business'}</div>
        <p className="mb-3 text-[12.5px] text-ink-500">{demoMode ? 'Restore the original demo business, clients and appointments.' : 'Replaces your data with the demo business. Export a backup first.'}</p>
        <button onClick={askResetDemo} className="min-h-[44px] rounded-lg border border-ivory-400 px-3.5 py-2 text-[12.5px] font-bold text-ink-700 hover:border-bad-500 hover:text-bad-500">{demoMode ? 'Reset Demo' : 'Replace With Demo…'}</button>
      </div>
      <div className="rounded-xl border border-bad-100 bg-bad-100/40 p-4">
        <div className="mb-1 text-[13.5px] font-bold text-bad-600">{demoMode ? 'Start my real business' : 'Clear client & booking data'}</div>
        <p className="mb-3 text-[12.5px] text-ink-500">Removes every client, appointment, payment and expense so you can start fresh — your settings, services, team and inventory items stay. A recovery copy is kept.</p>
        <button onClick={clearAllData} className="min-h-[44px] rounded-lg bg-bad-500 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-bad-600">Clear Client &amp; Booking Data</button>
      </div>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-lg bg-ivory-100 px-3 py-2">
      <div className="text-[11px] text-ink-400">{label}</div>
      <div className={`font-semibold ${bad ? 'text-bad-600' : 'text-ink-900'}`}>{value}</div>
    </div>
  );
}
