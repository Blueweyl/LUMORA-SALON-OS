import { useRef } from 'react';
import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';
import { CURRENCIES } from '../../data/seed';
import type { SettingsTab } from '../../store/types';

const TABS: SettingsTab[] = ['Business', 'Services', 'Team', 'Booking', 'Loyalty', 'Data'];

export function SettingsModal() {
  const show = useStore((s) => s.showSettings);
  const tab = useStore((s) => s.settingsTab);
  const setTab = useStore((s) => s.setSettingsTab);
  const close = useStore((s) => s.closeSettings);
  const business = useStore((s) => s.business);
  const updateBiz = useStore((s) => s.updateBusinessField);
  const staff = useStore((s) => s.staff);
  const addStaff = useStore((s) => s.addStaff);
  const updateStaff = useStore((s) => s.updateStaff);
  const removeStaff = useStore((s) => s.removeStaff);
  const setSection = useStore((s) => s.setSection);
  const setMoneyTab = useStore((s) => s.setMoneyTab);
  const setGrowTab = useStore((s) => s.setGrowTab);
  const askResetDemo = useStore((s) => s.askResetDemo);
  const clearAllData = useStore((s) => s.clearAllData);
  const toast = useStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!show) return null;

  const goTo = (section: 'money' | 'grow', sub: string) => {
    close();
    setSection(section);
    if (section === 'money') setMoneyTab(sub as Parameters<typeof setMoneyTab>[0]);
    if (section === 'grow') setGrowTab(sub as Parameters<typeof setGrowTab>[0]);
  };

  const exportData = () => {
    const data = localStorage.getItem('lumora-salon-os-v1') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumora-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        JSON.parse(String(reader.result));
        localStorage.setItem('lumora-salon-os-v1', String(reader.result));
        toast('Backup imported — reloading…');
        setTimeout(() => window.location.reload(), 700);
      } catch {
        toast('That file could not be read as a Lumora backup');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal onClose={close} maxWidth={640}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-serif text-[22px] font-medium text-ink-900">Settings</h2>
        <button onClick={close} className="text-ink-400 hover:text-ink-900"><Icon name="close" size={18} /></button>
      </div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-ivory-400">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`mr-4 border-b-2 pb-2.5 text-[13.5px] font-bold ${tab === t ? 'border-plum-600 text-plum-600' : 'border-transparent text-ink-400'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Business' && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Business name
            <input value={business.name} onChange={(e) => updateBiz('name', e.target.value)} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Currency
              <select
                value={business.currencyCode}
                onChange={(e) => {
                  const c = CURRENCIES.find((cur) => cur.code === e.target.value)!;
                  updateBiz('currencyCode', c.code);
                  updateBiz('currencySymbol', c.symbol);
                }}
                className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
              Hours
              <input value={business.hours} onChange={(e) => updateBiz('hours', e.target.value)} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
            </label>
          </div>
        </div>
      )}

      {tab === 'Services' && (
        <div>
          <p className="mb-3 text-[13.5px] text-ink-500">Services and pricing live in Money to avoid duplicate screens.</p>
          <button onClick={() => goTo('money', 'Pricing')} className="rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Manage Services →</button>
        </div>
      )}

      {tab === 'Team' && (
        <div>
          <div className="mb-3 flex flex-col gap-2">
            {staff.map((st) => (
              <div key={st.id} className="flex items-center gap-2 rounded-lg border border-ivory-400 p-2.5">
                <input value={st.name} onChange={(e) => updateStaff(st.id, 'name', e.target.value)} className="flex-1 rounded-md border border-ivory-300 px-2.5 py-1.5 text-[13px] font-semibold" />
                <input value={st.role} onChange={(e) => updateStaff(st.id, 'role', e.target.value)} className="flex-1 rounded-md border border-ivory-300 px-2.5 py-1.5 text-[13px]" />
                <button onClick={() => removeStaff(st.id)} className="rounded-md border border-ivory-300 p-1.5 text-ink-400 hover:border-bad-500 hover:text-bad-500"><Icon name="trash" size={13} /></button>
              </div>
            ))}
          </div>
          <button onClick={() => addStaff('New Staff', 'Stylist')} className="rounded-[10px] border border-dashed border-ivory-500 px-4 py-2.5 text-[13px] font-bold text-plum-600">+ Add Team Member</button>
        </div>
      )}

      {tab === 'Booking' && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Default deposit ({business.depositPct}%)
            <input type="range" min={0} max={50} value={business.depositPct} onChange={(e) => updateBiz('depositPct', Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Buffer between appointments (minutes)
            <input type="number" value={business.bufferMin} onChange={(e) => updateBiz('bufferMin', Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Cancellation window (hours)
            <input type="number" value={business.cancellationWindowHrs} onChange={(e) => updateBiz('cancellationWindowHrs', Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Typical rebook cadence (weeks)
            <input type="number" value={business.rebookWeeks} onChange={(e) => updateBiz('rebookWeeks', Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
          </label>
        </div>
      )}

      {tab === 'Loyalty' && (
        <div>
          <p className="mb-3 text-[13.5px] text-ink-500">Loyalty tiers, points and rewards live in Grow to avoid duplicate screens.</p>
          <button onClick={() => goTo('grow', 'Loyalty')} className="rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Manage Loyalty →</button>
        </div>
      )}

      {tab === 'Data' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-ivory-400 p-4">
            <div className="mb-1 text-[13.5px] font-bold text-ink-900">Backup &amp; restore</div>
            <p className="mb-3 text-[12.5px] text-ink-500">Lumora runs fully offline. Export a backup file to keep somewhere safe, or move your data to another device.</p>
            <div className="flex gap-2">
              <button onClick={exportData} className="flex items-center gap-1.5 rounded-lg border border-ivory-400 px-3.5 py-2 text-[12.5px] font-bold text-ink-700 hover:border-plum-600 hover:text-plum-600">
                <Icon name="download" size={14} /> Export Backup
              </button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-ivory-400 px-3.5 py-2 text-[12.5px] font-bold text-ink-700 hover:border-plum-600 hover:text-plum-600">
                <Icon name="upload" size={14} /> Import Backup
              </button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            </div>
          </div>
          <div className="rounded-xl border border-ivory-400 p-4">
            <div className="mb-1 text-[13.5px] font-bold text-ink-900">Reset demo data</div>
            <p className="mb-3 text-[12.5px] text-ink-500">Restore the original demo business, clients and appointments.</p>
            <button onClick={askResetDemo} className="rounded-lg border border-ivory-400 px-3.5 py-2 text-[12.5px] font-bold text-ink-700 hover:border-plum-600 hover:text-plum-600">Reset Demo</button>
          </div>
          <div className="rounded-xl border border-bad-100 bg-bad-100/40 p-4">
            <div className="mb-1 text-[13.5px] font-bold text-bad-600">Clear demo data</div>
            <p className="mb-3 text-[12.5px] text-ink-500">Remove every demo client, appointment and payment so you can start entering your real business — your services and settings stay.</p>
            <button onClick={clearAllData} className="rounded-lg bg-bad-500 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-bad-600">Clear Client &amp; Booking Data</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
