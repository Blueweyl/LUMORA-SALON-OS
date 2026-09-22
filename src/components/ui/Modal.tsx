import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  labelledBy?: string;
}

export function Modal({ onClose, children, maxWidth = 480 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full animate-lum-pop rounded-2xl bg-white p-6 shadow-[var(--shadow-pop)] max-h-[88vh] overflow-y-auto"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 font-serif text-[22px] font-medium text-ink-900">{children}</h2>;
}
