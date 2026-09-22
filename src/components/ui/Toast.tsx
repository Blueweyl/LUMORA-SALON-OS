import { useStore } from '../../store/store';

export function Toast() {
  const msg = useStore((s) => s.toastMsg);
  if (!msg) return null;
  return (
    <div
      key={msg}
      className="fixed bottom-24 left-1/2 z-[300] animate-lum-toast rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-pop)] md:bottom-8"
      style={{ transform: 'translateX(-50%)' }}
    >
      {msg}
    </div>
  );
}
