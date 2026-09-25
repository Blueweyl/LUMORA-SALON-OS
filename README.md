# Lumora — Beauty Business OS

Book. Serve. Get Paid. Rebook. Grow.

Lumora is a one-time-purchase, fully offline salon/beauty business app for solo
stylists and small teams, delivered as a **single HTML file** (`lumora.html`).
Double-click it to open it in any modern browser — no internet, account,
server or subscription needed. Everything (clients, bookings, payments,
inventory, loyalty) is saved in that browser's local storage on that device.

## Stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4 for styling (plum/ivory design system defined in `src/index.css`)
- Zustand for state, persisted to `localStorage`

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm test          # unit/integration tests (vitest)
npm run build     # type-check and build ONE self-contained dist/index.html
npm run release   # build and copy it to lumora.html (the file customers get)
npm run test:e2e  # build, then drive the real file in Chromium with the network blocked
```

The build inlines all JavaScript, CSS, fonts and the icon into a single HTML
file, so it works when opened straight from disk (`file://`) with no network.

## Data safety (what buyers should know)

- Data is saved automatically in **this browser on this device only**. Private
  windows, clearing site data, or another browser/device won't have it.
- **Settings → Data** shows save status, when the last backup was made, and
  how much is stored. A "Back up" reminder appears in the top bar when real data
  hasn't been backed up for 7 days.
- **Export Backup** downloads one `.json` file. **Restore From Backup** checks
  the file (format, version, every record) before touching anything, shows a
  summary, and saves a recovery copy of the current data first — so any
  restore, reset or clear can be undone from Settings → Data.
- If saved data is ever unreadable, Lumora still opens, keeps the unreadable
  copy aside, and tells the user how to restore from a backup.
- Clients, staff and services are archived rather than deleted when they have
  history, so past appointments and payments always keep their names and
  totals. Payments are voided (kept, struck through) rather than deleted.

## Structure

- `src/types.ts` — domain types (clients, appointments, services, inventory, …)
- `src/data/seed.ts` — realistic demo data generated relative to "today"
- `src/store/` — the Zustand store: state shape, defaults, and every action
- `src/lib/` — pure helpers: pricing math, scheduling/conflict detection and
  business hours, backup validation/repair (`backup.ts`), safe storage and
  recovery copies (`storage.ts`), and derived selectors (balances are always
  computed from payments; revenue, retention groups, search, etc.)
- `tests/` — vitest suites for backup/restore, scheduling and the store's
  booking/checkout/archive/persistence flows; `tests/e2e/run.mjs` for browser QA
- `src/screens/` — the five main sections: Home, Clients, Bookings, Money, Grow
- `src/components/` — onboarding, modals (new client/appointment, checkout,
  settings), and shared layout/UI pieces

## Notable flows

- Onboarding: **Explore Demo Business** loads full seeded data; **Set Up My
  Business** walks through a 5-step wizard (business → services → team →
  hours → booking defaults) and applies it on top of the demo data.
- Booking: New Appointment supports multi-service selection, staff/time
  picking and open-slot suggestions. Staff double-bookings and past dates are
  blocked; bookings outside business hours need an explicit override.
  Appointments can be rescheduled with the same checks, and repeat bookings
  skip clashing or closed days.
- Checkout: check-in → start service → checkout shows an itemized bill
  (services, discount, deposit, balance, products, tip), records one payment,
  deducts service-linked supplies and sold products, updates client history
  and loyalty, and offers a rebook. It can't be completed twice.
- Money → Pricing includes a live service-cost/margin calculator with a
  target-margin slider and one-click "apply suggested price".
- Grow surfaces actionable retention/loyalty/review/referral/content
  opportunities computed from live client and appointment data, with
  copy-to-clipboard outreach message templates (this is an offline app —
  it never sends messages on its own).

This is a frontend prototype: payments are recorded rather than processed,
and there is no real messaging/email/SMS integration — those actions
generate a message you can copy and send yourself.
