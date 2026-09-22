# Lumora — Beauty Business OS

Book. Serve. Get Paid. Rebook. Grow.

Lumora is an interactive frontend prototype for a one-time-purchase, fully offline
salon/beauty business app aimed at solo stylists and small teams. It is a
client-only React app — everything (clients, bookings, payments, inventory,
loyalty) lives in `localStorage`, no backend or account required.

## Stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4 for styling (plum/ivory design system defined in `src/index.css`)
- Zustand for state, persisted to `localStorage`

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check and produce a static build in dist/
npm run preview   # serve the production build locally
```

`npm run build` outputs a fully static `dist/` folder — open `dist/index.html`
through a local server (or `npm run preview`) to use the app completely offline.

## Structure

- `src/types.ts` — domain types (clients, appointments, services, inventory, …)
- `src/data/seed.ts` — realistic demo data generated relative to "today"
- `src/store/` — the Zustand store: state shape, defaults, and every action
- `src/lib/` — pure helpers: pricing math, scheduling/conflict detection,
  date formatting, loyalty tiers, and derived selectors (revenue, retention
  groups, growth opportunities, etc.)
- `src/screens/` — the five main sections: Home, Clients, Bookings, Money, Grow
- `src/components/` — onboarding, modals (new client/appointment, checkout,
  settings), and shared layout/UI pieces

## Notable flows

- Onboarding: **Explore Demo Business** loads full seeded data; **Set Up My
  Business** walks through a 5-step wizard (business → services → team →
  hours → booking defaults) and applies it on top of the demo data.
- Booking: New Appointment supports multi-service selection, staff/time
  picking, live conflict detection, and "smart scheduling" time suggestions.
- Checkout: check-in → start service → checkout deducts service-linked
  inventory, offers retail upsells, records payment + tip, awards loyalty
  points, and suggests a rebook date.
- Money → Pricing includes a live service-cost/margin calculator with a
  target-margin slider and one-click "apply suggested price".
- Grow surfaces actionable retention/loyalty/review/referral/content
  opportunities computed from live client and appointment data, with
  copy-to-clipboard outreach message templates (this is an offline app —
  it never sends messages on its own).

This is a frontend prototype: payments are recorded rather than processed,
and there is no real messaging/email/SMS integration — those actions
generate a message you can copy and send yourself.
