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

export function MobileNav() {
  const section = useStore((s) => s.section);
  const setSection = useStore((s) => s.setSection);

  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-[100] flex border-t border-ivory-400 bg-white/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {NAV.map((n) => {
        const active = section === n.key;
        return (
          <button key={n.key} onClick={() => setSection(n.key)} aria-current={active ? 'page' : undefined} className="flex min-h-[52px] flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold" style={{ color: active ? 'var(--color-plum-600)' : 'var(--color-ink-400)' }}>
            <Icon name={n.icon} size={19} />
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}
