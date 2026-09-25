import { useStore } from '../../store/store';

export function Toast() {
  const msg = useStore((s) => s.toastMsg);
  const id = useStore((s) => s.toastId);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[300] flex justify-center px-4 md:bottom-8">
      {msg && (
        <div key={id} className="max-w-[560px] animate-lum-fade rounded-2xl bg-ink-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-[var(--shadow-pop)]">
          {msg}
        </div>
      )}
    </div>
  );
}
