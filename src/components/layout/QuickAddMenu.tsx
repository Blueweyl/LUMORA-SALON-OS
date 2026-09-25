import { useStore } from '../../store/store';
import { Icon } from '../icons';

export function QuickAddMenu() {
  const show = useStore((s) => s.showQuickAdd);
  const toggle = useStore((s) => s.toggleQuickAdd);
  const close = useStore((s) => s.closeQuickAdd);
  const openNewAppt = useStore((s) => s.openNewAppt);
  const openNewClient = useStore((s) => s.openNewClient);
  const setSection = useStore((s) => s.setSection);
  const setMoneyTab = useStore((s) => s.setMoneyTab);
  const openRecordPayment = useStore((s) => s.openRecordPayment);

  const items = [
    { label: 'New Appointment', icon: 'calendar' as const, onClick: () => { close(); openNewAppt(); } },
    { label: 'New Client', icon: 'user-plus' as const, onClick: () => { close(); openNewClient(); } },
    { label: 'New Expense', icon: 'card' as const, onClick: () => { close(); setSection('money'); setMoneyTab('Expenses'); } },
    { label: 'Record Payment', icon: 'dollar-sign' as const, onClick: () => { close(); openRecordPayment(); } },
  ];

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Quick add"
        aria-expanded={show}
        aria-haspopup="menu"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-plum-600 text-white shadow-sm hover:bg-plum-700"
      >
        <Icon name="plus" size={19} />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-[75]" onClick={close} />
          <div role="menu" onKeyDown={(e) => e.key === 'Escape' && close()} className="absolute right-0 top-[48px] z-[80] w-56 animate-lum-pop rounded-xl border border-ivory-400 bg-white p-1.5 shadow-[var(--shadow-pop)]">
            {items.map((it) => (
              <button key={it.label} role="menuitem" onClick={it.onClick} className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold text-ink-900 hover:bg-plum-50">
                <Icon name={it.icon} size={16} className="text-plum-600" />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
