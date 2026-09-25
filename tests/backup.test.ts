import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, repairDomain } from '../src/lib/backup';
import { seedAppointments, seedClients, seedPayments, seedServices, seedStaff, defaultBusiness } from '../src/data/seed';
import type { Domain } from '../src/store/types';

function sampleDomain(): Domain {
  const appointments = seedAppointments();
  return {
    business: defaultBusiness(),
    staff: seedStaff(),
    services: seedServices(),
    clients: seedClients(),
    appointments,
    inventory: [],
    payments: seedPayments(appointments),
    expenses: [],
    waitlist: [],
    content: [],
    giftCards: [],
    loyaltyRewards: [],
    demoMode: false,
    onboardingComplete: true,
    lastBackupAt: null,
  };
}

describe('parseBackup (strict import validation)', () => {
  it('round-trips a current-format backup without losing records', () => {
    const d = sampleDomain();
    const file = JSON.stringify(buildBackup(d, '2026-01-01T10:00:00.000Z'));
    const r = parseBackup(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.domain.clients).toHaveLength(d.clients.length);
    expect(r.domain.appointments).toHaveLength(d.appointments.length);
    expect(r.domain.payments.map((p) => p.amount)).toEqual(d.payments.map((p) => p.amount));
    expect(r.summary.counts.clients).toBe(d.clients.length);
    expect(r.summary.exportedAt).toBe('2026-01-01T10:00:00.000Z');
    expect(r.summary.businessName).toBe(d.business.name);
  });

  it('accepts the raw storage format exported by the first release', () => {
    const d = sampleDomain();
    const legacy = JSON.stringify({ state: { ...d, business: { ...d.business, openDays: undefined, openTime: undefined, closeTime: undefined } }, version: 0 });
    const r = parseBackup(legacy);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Structured hours are derived from the legacy free-text label.
      expect(r.domain.business.openDays).toEqual([2, 3, 4, 5, 6]);
      expect(r.domain.business.openTime).toBe('09:00');
      expect(r.domain.business.closeTime).toBe('18:00');
    }
  });

  it('rejects text that is not JSON', () => {
    const r = parseBackup('hello, not json');
    expect(r.ok).toBe(false);
  });

  it('rejects JSON that is not a Lumora backup', () => {
    expect(parseBackup(JSON.stringify({ foo: 1 })).ok).toBe(false);
    expect(parseBackup(JSON.stringify([1, 2, 3])).ok).toBe(false);
    expect(parseBackup('null').ok).toBe(false);
  });

  it('rejects a backup missing required sections', () => {
    const d = sampleDomain();
    const broken = buildBackup(d, '2026-01-01T00:00:00Z') as unknown as { data: Record<string, unknown> };
    delete broken.data.clients;
    const r = parseBackup(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/missing: clients/);
  });

  it('rejects a backup whose sections have the wrong type', () => {
    const d = sampleDomain();
    const broken = buildBackup(d, '2026-01-01T00:00:00Z') as unknown as { data: Record<string, unknown> };
    broken.data.appointments = 'oops';
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false);
  });

  it('rejects a backup containing damaged records instead of silently dropping them', () => {
    const d = sampleDomain();
    const broken = buildBackup(d, '2026-01-01T00:00:00Z') as unknown as { data: { appointments: unknown[] } };
    broken.data.appointments.push({ id: 'x', clientId: 'cl_sarah', date: 'not-a-date', time: '10:00' });
    const r = parseBackup(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/damaged/);
  });

  it('every seeded demo client has a unique id', () => {
    const ids = seedClients().map((c) => c.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects duplicate record ids', () => {
    const d = sampleDomain();
    d.clients.push({ ...d.clients[0] });
    expect(parseBackup(JSON.stringify(buildBackup(d, 'x'))).ok).toBe(false);
  });

  it('rejects backups from a newer schema version', () => {
    const d = sampleDomain();
    const file = { ...buildBackup(d, 'x'), schemaVersion: 99 };
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/);
  });

  it('warns (but accepts) history for clients deleted before the backup', () => {
    const d = sampleDomain();
    d.clients = d.clients.filter((c) => c.id !== 'cl_sarah');
    const r = parseBackup(JSON.stringify(buildBackup(d, 'x')));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary.warnings.join(' ')).toMatch(/Deleted client/);
  });

  it('clamps impossible money values on import', () => {
    const d = sampleDomain();
    d.appointments[0] = { ...d.appointments[0], price: 100, discount: 500, deposit: 50 };
    const r = parseBackup(JSON.stringify(buildBackup(d, 'x')));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const a = r.domain.appointments[0];
      expect(a.discount).toBe(100);
      expect(a.deposit).toBe(0);
    }
  });
});

describe('repairDomain (tolerant load of stored data)', () => {
  it('turns garbage into a usable empty workspace', () => {
    for (const junk of [null, 42, 'str', [], { clients: 'x', appointments: {} }]) {
      const { domain } = repairDomain(junk);
      expect(Array.isArray(domain.clients)).toBe(true);
      expect(Array.isArray(domain.appointments)).toBe(true);
      expect(domain.staff.length).toBeGreaterThan(0);
      expect(domain.business.openDays.length).toBeGreaterThan(0);
    }
  });

  it('drops only the unreadable records, repairs id-less clients, and reports it', () => {
    const d = sampleDomain();
    const raw = { ...d, clients: [...d.clients, null, { id: '', name: 'Kept Without Id' }, { id: 'ok', name: '' }] };
    const r = repairDomain(raw);
    expect(r.domain.clients).toHaveLength(d.clients.length + 1);
    expect(r.domain.clients.find((c) => c.name === 'Kept Without Id')?.id).toMatch(/^cl_repaired_/);
    expect(r.dropped).toBe(2);
    expect(r.problems.join(' ')).toMatch(/client/);
  });

  it('fills defaults for fields added in later versions', () => {
    const d = sampleDomain();
    const raw = JSON.parse(JSON.stringify(d));
    delete raw.lastBackupAt;
    raw.payments[0].voided = 'nope';
    const r = repairDomain(raw);
    expect(r.domain.lastBackupAt).toBeNull();
    expect(r.domain.payments[0].voided).toBeUndefined();
    expect(r.dropped).toBe(0);
  });
});
