import type { ReactNode } from 'react';

export function Pill({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full" style={{ background: color, width: size, height: size }} />;
}
