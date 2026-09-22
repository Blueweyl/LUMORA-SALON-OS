import { useStore } from '../../store/store';
import { Icon } from '../icons';
import type { SectionKey } from '../../types';

const NAV: { key: SectionKey; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'clients', label: 'Clients', icon: 'clients' },
  { key: 'bookings', label: 'Bookings', icon: 'bookings' },
  { key: 'money', label: 'Money', icon: 'money' },
  { key: 'grow', label: 'Grow', icon: 'grow' },
];

export function Sidebar() {
  const section = useStore((s) => s.section);
  const setSection = useStore((s) => s.setSection);
  const openSettings = useStore((s) => s.openSettings);

  return (
    <div className="hidden w-[204px] flex-none flex-col gap-1 border-r border-ivory-400 bg-ivory-50 px-3 py-5 md:flex">
      {NAV.map((n) => {
        const active = section === n.key;
        return (
          <button
            key={n.key}
            onClick={() => setSection(n.key)}
            className={`flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-left text-[14px] font-semibold transition-colors ${
              active ? 'bg-plum-100 text-plum-600' : 'text-ink-500 hover:bg-plum-50 hover:text-ink-900'
            }`}
          >
            <Icon name={n.icon} size={17} />
            {n.label}
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={() => openSettings()}
        className="flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink-400 hover:bg-plum-50 hover:text-ink-900"
      >
        <Icon name="settings" size={16} />
        Settings
      </button>
    </div>
  );
}
