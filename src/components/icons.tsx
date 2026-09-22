import type { SVGProps } from 'react';

type IconName =
  | 'home' | 'clients' | 'bookings' | 'money' | 'grow' | 'search' | 'plus' | 'settings'
  | 'close' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'check' | 'alert'
  | 'calendar' | 'clock' | 'phone' | 'mail' | 'star' | 'gift' | 'trending-up'
  | 'camera' | 'note' | 'card' | 'box' | 'bell' | 'user-plus' | 'dollar-sign'
  | 'trash' | 'edit' | 'copy' | 'arrow-right' | 'refresh' | 'download' | 'upload'
  | 'sparkles' | 'instagram' | 'link';

const paths: Record<IconName, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  clients: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5M16 11a3 3 0 1 0 0-6M17 14.6c2 .4 3.6 2.2 4 5',
  bookings: 'M5 8h14M7 4v3M17 4v3M5 6.5h14A1.5 1.5 0 0 1 20.5 8v11a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V8A1.5 1.5 0 0 1 5 6.5ZM8 12h2M8 15.5h2M14 12h2M14 15.5h2',
  money: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 2.8c0 3.6 10 1.8 10 5.5 0 1.9-2.2 3-5 3s-5-1.1-5-3',
  grow: 'm4 16 5-5 4 3 7-8M14 5.5h6V11.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5 16 16',
  plus: 'M12 5v14M5 12h14',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM4 12.8v-1.6l1.9-.5c.1-.5.3-.9.5-1.3l-1-1.7 1.1-1.1 1.7 1c.4-.2.8-.4 1.3-.5l.5-1.9h1.6l.5 1.9c.5.1.9.3 1.3.5l1.7-1 1.1 1.1-1 1.7c.2.4.4.8.5 1.3l1.9.5v1.6l-1.9.5c-.1.5-.3.9-.5 1.3l1 1.7-1.1 1.1-1.7-1c-.4.2-.8.4-1.3.5l-.5 1.9h-1.6l-.5-1.9a5 5 0 0 1-1.3-.5l-1.7 1-1.1-1.1 1-1.7a5 5 0 0 1-.5-1.3z',
  close: 'M5 5l14 14M19 5 5 19',
  'chevron-left': 'm14.5 5-7 7 7 7',
  'chevron-right': 'm9.5 5 7 7-7 7',
  'chevron-down': 'm5 8.5 7 7 7-7',
  check: 'm4.5 12.5 5 5 10-11',
  alert: 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01',
  calendar: 'M5 8h14M7 4v3M17 4v3M5 6.5h14A1.5 1.5 0 0 1 20.5 8v11a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V8A1.5 1.5 0 0 1 5 6.5Z',
  clock: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 7.5V12l3 2',
  phone: 'M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2C10.6 19 5 13.4 4.5 6.2A2 2 0 0 1 6.5 4Z',
  mail: 'M4 6h16v12H4zM4.5 6.5 12 13l7.5-6.5',
  star: 'm12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z',
  gift: 'M4 10h16v10H4zM12 10v10M4 7.5h16V10H4zM12 7.5C10 7.5 8 6.5 8 5s1.5-2 2.5-1S12 6.5 12 7.5ZM12 7.5c2 0 4-1 4-2.5s-1.5-2-2.5-1S12 6.5 12 7.5Z',
  'trending-up': 'm3 15 6-6 4 4 8-9M14 4h7v7',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  note: 'M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1ZM14.5 3.5V8h4M8 12h8M8 15.5h8M8 8.5h3',
  card: 'M3.5 6.5h17a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1ZM2.5 10.5h19M6 14.5h4',
  box: 'M3.5 7.5 12 3l8.5 4.5V17L12 21.5 3.5 17ZM3.5 7.5 12 12l8.5-4.5M12 12v9.5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9ZM9.5 17.5a2.5 2.5 0 0 0 5 0',
  'user-plus': 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5M18 8v6M15 11h6',
  'dollar-sign': 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 2.8c0 3.6 10 1.8 10 5.5 0 1.9-2.2 3-5 3s-5-1.1-5-3',
  trash: 'M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13',
  edit: 'M16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4.5 1L4.5 15.5Z',
  copy: 'M9 9h10v10H9zM6 15H4.5A1.5 1.5 0 0 1 3 13.5V6a1.5 1.5 0 0 1 1.5-1.5H13a1.5 1.5 0 0 1 1.5 1.5V7.5',
  'arrow-right': 'M4 12h16M13 5l7 7-7 7',
  refresh: 'M20 11A8 8 0 1 0 18.6 17M20 5v6h-6',
  download: 'M12 3.5v11M8 11l4 4 4-4M4.5 17v3a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3',
  upload: 'M12 15.5v-11M8 8l4-4 4 4M4.5 17v3a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3',
  sparkles: 'm12 3 1.5 4L18 8.5 14 10l-1.5 4L11 10 7 8.5 11 7ZM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8Z',
  instagram: 'M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10A3.5 3.5 0 0 1 17 20.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5ZM12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4ZM16.6 7.4h.01',
  link: 'M9.5 14.5 14.5 9.5M8 17H6.5a4 4 0 0 1 0-8H8M16 7h1.5a4 4 0 0 1 0 8H16',
};

export function Icon({ name, size = 18, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
