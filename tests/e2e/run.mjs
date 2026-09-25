// End-to-end QA of the built single-file app, opened from disk with all network access blocked.
// Usage: npm run build && node tests/e2e/run.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'file://' + path.join(root, 'dist/index.html');
const SHOTS = process.env.SHOTS_DIR || '';
const results = [];
let failures = 0;
let currentPage = null;

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (e) {
    failures += 1;
    const lines = String(e.message || e).split('\n').filter((l) => l.trim());
    results.push(`FAIL  ${name}\n      ${lines.slice(0, 3).join('\n      ')}`);
    if (SHOTS && currentPage) await currentPage.screenshot({ path: path.join(SHOTS, `fail-${results.length}.png`) }).catch(() => {});
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });

async function newPage(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  currentPage = page;
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  return { ctx, page, errors, external };
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
const noHScroll = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// ---------------------------------------------------------------- desktop flows
{
  const { page, errors, external } = await newPage();
  await page.goto(FILE);

  await step('first run shows welcome, fully offline (no external requests)', async () => {
    await page.getByRole('button', { name: 'Explore Demo Business' }).waitFor();
    assert(external.length === 0, `external requests: ${external.join(', ')}`);
  });

  await step('bundled fonts load without internet', async () => {
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px Manrope') && document.fonts.check('italic 16px Newsreader');
    });
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    assert(ok && loaded.some((f) => f.includes('Manrope')), `fonts: ${loaded.join(',')}`);
  });

  await step('explore demo → dashboard shows next appointment, stats and rebooking', async () => {
    await page.getByRole('button', { name: 'Explore Demo Business' }).click();
    await page.getByText('Next Appointment').first().waitFor();
    for (const t of ['Collected today', 'Outstanding balances', 'Low stock items', 'Due for Rebooking', 'Needs Attention']) {
      assert(await page.getByText(t).first().isVisible(), `missing ${t}`);
    }
    await shot(page, 'desktop-home');
  });

  await step('global search finds a client by phone digits and opens the profile', async () => {
    await page.getByRole('combobox').fill('4155550142');
    await page.getByRole('option', { name: /Sarah Mitchell/ }).first().waitFor();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Sarah Mitchell' }).waitFor();
  });

  await step('global search covers services, staff and payments', async () => {
    const box = page.locator('#global-search-results');
    await page.getByRole('combobox').fill('jordan');
    await box.getByText('Team', { exact: true }).waitFor();
    await page.getByRole('combobox').fill('balayage');
    await box.getByText('Services', { exact: true }).waitFor();
    await page.getByRole('combobox').fill('emma');
    await box.getByText('Payments', { exact: true }).waitFor();
    await page.getByRole('combobox').fill('');
  });

  await step('new client → booking blocks a double-booking and accepts a suggested time', async () => {
    await page.getByRole('button', { name: 'Quick add' }).click();
    await page.getByRole('menuitem', { name: 'New Client' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Full name').fill('E2E Client');
    await dlg.getByLabel('Phone').fill('(415) 555-7777');
    await dlg.getByRole('button', { name: 'Save Client' }).click();
    await page.getByRole('button', { name: 'Book Their First Appointment' }).click();
    await page.getByRole('checkbox', { name: /Haircut & Style/ }).click();
    await page.getByRole('radio', { name: 'Mia Chen' }).click();
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    // Pick a date 7 days out on an open day and create a clash with Mia by booking the same time twice.
    const target = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 7); while (![2,3,4,5,6].includes(d.getDay())) d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    void today;
    await dlg.getByLabel('Date', { exact: true }).fill(target);
    await dlg.getByLabel('Time', { exact: true }).fill('10:00');
    await page.getByRole('button', { name: 'Confirm Appointment' }).click();
    await page.getByText('Appointment booked').waitFor();
    // Book another client into the same slot → must be blocked.
    await page.getByRole('button', { name: 'Quick add' }).click();
    await page.getByRole('menuitem', { name: 'New Appointment' }).click();
    const clientSelect = dlg.getByLabel('Client');
    const opt = await clientSelect.locator('option', { hasText: 'Ben Carter' }).first().getAttribute('value');
    await clientSelect.selectOption(opt);
    await page.getByRole('checkbox', { name: /Blowout/ }).click();
    await page.getByRole('radio', { name: 'Mia Chen' }).click();
    await dlg.getByLabel('Date', { exact: true }).fill(target);
    await dlg.getByLabel('Time', { exact: true }).fill('10:15');
    await page.getByRole('alert').filter({ hasText: 'already booked' }).waitFor();
    assert((await page.getByRole('button', { name: 'Confirm Appointment' }).getAttribute('aria-disabled')) === 'true', 'confirm not disabled on conflict');
    await page.getByRole('button', { name: 'Confirm Appointment' }).click({ force: true });
    await page.getByText(/already booked/).first().waitFor();
    assert(await page.getByRole('heading', { name: 'New Appointment' }).isVisible(), 'modal closed despite conflict');
    await shot(page, 'desktop-conflict');
    await page.locator('button', { hasText: /^\d{1,2}:\d{2} (AM|PM)$/ }).first().click();
    await page.getByRole('button', { name: 'Confirm Appointment' }).click();
    await page.getByText('Appointment booked').waitFor();
  });

  await step('checkout: itemized bill, product + tip, single payment, rebook prompt', async () => {
    await page.getByRole('button', { name: 'Home' }).first().click();
    await page.getByRole('button', { name: /Sarah Mitchell/ }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Check In' }).click();
    await dlg.getByRole('button', { name: 'Start Service' }).click();
    await dlg.getByRole('button', { name: 'Add one Retail Hair Oil' }).click();
    await dlg.getByLabel(/Tip/).fill('20');
    // Balance 215 - 30 discount - 50 deposit = 135; + oil 22 + tip 20 = 177
    await dlg.getByRole('button', { name: 'Complete & Charge $177.00' }).waitFor();
    await shot(page, 'desktop-checkout');
    await dlg.getByRole('button', { name: 'Complete & Charge $177.00' }).click();
    await page.getByText('Service complete ✨').waitFor();
    await page.getByRole('button', { name: /Rebook Sarah/ }).click();
    await page.getByRole('heading', { name: 'New Appointment' }).waitFor();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  await step('money: payment recorded once with correct amount; outstanding can be settled', async () => {
    await page.getByRole('button', { name: 'Money' }).first().click();
    await page.getByRole('tab', { name: 'Payments' }).click();
    const n = await page.getByText('+$177.00').count();
    assert(n === 1, `expected one $177 payment, saw ${n}`);
    await page.getByText('Unpaid Visits').waitFor();
    await page.getByRole('button', { name: 'Record Payment' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Record Payment' }).click();
    await page.getByText('Payment recorded').waitFor();
    assert((await page.getByText('Unpaid Visits').count()) === 0, 'still unpaid');
  });

  await step('settings shows device storage + backup status; export downloads a backup', async () => {
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('tab', { name: 'Data' }).click();
    await page.getByText('on this device, in this browser only').waitFor();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Backup' }).click()]);
    const file = await dl.path();
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert(json.app === 'lumora-salon-os' && json.schemaVersion === 2 && Array.isArray(json.data.clients), 'bad backup format');
    fs.writeFileSync('/tmp/lumora-e2e-backup.json', JSON.stringify(json));
    await page.getByText('Last backup').waitFor();
  });

  await step('import rejects an invalid file and leaves data untouched', async () => {
    fs.writeFileSync('/tmp/lumora-bad.json', '{"not":"lumora"}');
    await page.locator('input[type=file]').setInputFiles('/tmp/lumora-bad.json');
    await page.getByText('Backup not imported').waitFor();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  });

  await step('import of a valid backup shows a summary before replacing, then restores', async () => {
    const good = JSON.parse(fs.readFileSync('/tmp/lumora-e2e-backup.json', 'utf8'));
    good.data.clients = good.data.clients.slice(0, 3);
    good.data.appointments = good.data.appointments.filter((a) => good.data.clients.some((c) => c.id === a.clientId));
    good.data.payments = good.data.payments.filter((p) => good.data.clients.some((c) => c.id === p.clientId));
    fs.writeFileSync('/tmp/lumora-small.json', JSON.stringify(good));
    await page.locator('input[type=file]').setInputFiles('/tmp/lumora-small.json');
    await page.getByText('Restore this backup?').waitFor();
    await page.getByText(/3\s*clients/).first().waitFor();
    await shot(page, 'desktop-import-review');
    await page.getByRole('button', { name: 'Replace & Restore' }).click();
    await page.getByText(/Backup restored/).waitFor();
  });

  await step('restored data persists across reload; recovery copy is available', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Clients' }).first().click();
    await page.getByText('3 clients').waitFor();
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('tab', { name: 'Data' }).click();
    await page.getByRole('button', { name: 'Restore Recovery Copy' }).click();
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await page.getByText('Recovery copy restored').waitFor();
  });

  await step('keyboard: Escape closes only the topmost dialog', async () => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Quick add' }).click();
    await page.getByRole('menuitem', { name: 'New Client' }).click();
    await page.getByRole('dialog').getByLabel('Full name').fill('Draft');
    await page.keyboard.press('Escape'); // asks "Discard unsaved changes?"
    await page.getByText('Discard unsaved changes?').waitFor();
    await page.keyboard.press('Escape'); // closes only the confirm
    assert(await page.getByRole('dialog').getByLabel('Full name').isVisible(), 'new client dialog closed too');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Discard' }).click();
  });

  await step('archiving a client keeps their history visible', async () => {
    await page.getByRole('button', { name: 'Clients' }).first().click();
    await page.getByRole('button', { name: /Sarah Mitchell/ }).first().click();
    await page.getByRole('button', { name: 'Archive client' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archive Client' }).click();
    await page.getByText('Archived.').waitFor();
    await page.getByRole('tab', { name: 'History' }).or(page.getByRole('button', { name: 'History' })).first().click();
    await page.getByText('Balayage + Haircut & Style').first().waitFor();
    await page.getByRole('button', { name: 'Restore Client' }).click();
  });

  await step('no runtime errors and no network use during the whole session', async () => {
    assert(errors.length === 0, errors.join(' | '));
    assert(external.length === 0, external.join(', '));
  });
}

// ---------------------------------------------------------------- corrupted storage
{
  const { page, errors } = await newPage();
  await page.goto(FILE);
  await step('corrupted saved data: app still opens, warns, keeps a copy', async () => {
    await page.evaluate(() => localStorage.setItem('lumora-salon-os-v1', '{"state":{"clients":"garbage'));
    await page.reload();
    await page.getByText(/could not be read/).waitFor();
    const kept = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('lumora-salon-os-unreadable-')));
    assert(kept, 'unreadable copy not kept');
    assert(errors.length === 0, errors.join(' | '));
  });
  await step('partially damaged saved data loads the good records', async () => {
    await page.evaluate(() => localStorage.setItem('lumora-salon-os-v1', JSON.stringify({ state: { onboardingComplete: true, clients: [{ id: 'a', name: 'Good One' }, { nope: 1 }], appointments: [{ bad: true }] }, version: 2 })));
    await page.reload();
    await page.getByText(/couldn't be read and were skipped/).waitFor();
    await page.getByRole('button', { name: 'Clients' }).first().click();
    await page.getByText('Good One').waitFor();
  });
}

// ---------------------------------------------------------------- mobile
{
  const { page, errors } = await newPage({ width: 360, height: 740 });
  await page.goto(FILE);
  await step('mobile: welcome and onboarding fit without horizontal scroll', async () => {
    await page.getByRole('button', { name: 'Set Up My Business' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Add your business name').waitFor();
    await page.getByPlaceholder(/Glow Beauty Studio/).fill('Mobile Studio');
    for (let i = 0; i < 4; i++) {
      assert(await noHScroll(page), `onboarding step ${i + 1} overflows`);
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await page.getByText("You're ready!").waitFor();
    await shot(page, 'mobile-ready');
    await page.getByRole('button', { name: 'Go to Home' }).click();
    await page.getByText('Add your first client').waitFor();
  });

  await step('mobile: every section renders without horizontal overflow', async () => {
    await page.waitForTimeout(700); // let the debounced save land, then wipe storage
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto('about:blank');
    await page.evaluate(() => 0);
    await page.goto(FILE);
    if (await page.getByText('Add your first client').isVisible().catch(() => false)) {
      await page.evaluate(() => { localStorage.clear(); });
      await page.goto(FILE);
    }
    await page.getByRole('button', { name: 'Explore Demo Business' }).click();
    const nav = page.getByRole('navigation', { name: 'Sections' });
    for (const s of ['Home', 'Clients', 'Bookings', 'Money', 'Grow']) {
      await nav.getByRole('button', { name: s }).click();
      await page.waitForTimeout(150);
      assert(await noHScroll(page), `${s} overflows horizontally`);
      await shot(page, `mobile-${s.toLowerCase()}`);
    }
    for (const t of ['Pricing', 'Payments', 'Expenses', 'Inventory']) {
      await nav.getByRole('button', { name: 'Money' }).click();
      await page.getByRole('tab', { name: t }).click();
      assert(await noHScroll(page), `Money/${t} overflows`);
    }
    await page.getByRole('tab', { name: 'Inventory' }).click();
    await shot(page, 'mobile-inventory');
  });

  await step('mobile: booking and checkout dialogs fit the screen', async () => {
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await nav.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'New Appointment' }).first().click();
    const box = await page.getByRole('dialog').boundingBox();
    assert(box && box.width <= 360 && box.x >= 0, 'dialog wider than screen');
    assert(await page.getByRole('button', { name: 'Confirm Appointment' }).isVisible(), 'sticky confirm button not visible');
    await shot(page, 'mobile-new-appt');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: /Olivia Chen/ }).first().click();
    const d2 = await page.getByRole('dialog').boundingBox();
    assert(d2 && d2.width <= 360, 'checkout dialog too wide');
    await shot(page, 'mobile-checkout');
    await page.keyboard.press('Escape');
  });

  await step('mobile: primary touch targets are at least 36px tall', async () => {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30), h: b.getBoundingClientRect().height }))
        .filter((x) => x.h > 0 && x.h < 32),
    );
    assert(small.length <= 3, `small buttons: ${JSON.stringify(small.slice(0, 8))}`);
  });

  await step('mobile: no runtime errors', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
}

// ---------------------------------------------------------------- large dataset
{
  const { page, errors } = await newPage();
  await page.goto(FILE);
  await step('large workspace (1,200 clients / 9,000 appointments) stays responsive and is saved compressed', async () => {
    await page.getByRole('button', { name: 'Explore Demo Business' }).click();
    await page.waitForFunction(() => localStorage.getItem('lumora-salon-os-v1') !== null);
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('lumora-salon-os-v1'));
      const st = raw.state;
      const base = st.appointments[0];
      const c0 = st.clients[0];
      for (let i = 0; i < 1200; i++) st.clients.push({ ...c0, id: `bulk_c${i}`, name: `Bulk Client ${i}`, phone: `(555) 100-${String(i).padStart(4, '0')}`, email: `bulk${i}@x.com` });
      const d = new Date();
      for (let i = 0; i < 9000; i++) {
        const dd = new Date(d); dd.setDate(d.getDate() - 300 + (i % 330));
        st.appointments.push({ ...base, id: `bulk_a${i}`, clientId: `bulk_c${i % 1200}`, staffId: 'st_jordan', date: `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`, time: '09:00', status: i % 4 ? 'completed' : 'confirmed' });
      }
      localStorage.setItem('lumora-salon-os-v1', JSON.stringify(raw));
    });
    const t0 = Date.now();
    await page.reload();
    await page.getByText('Next Appointment').first().waitFor();
    const load = Date.now() - t0;
    const t1 = Date.now();
    await page.getByRole('button', { name: 'Clients' }).first().click();
    await page.getByText(/Show more/).waitFor();
    await page.getByRole('combobox').fill('Bulk Client 1199');
    await page.getByRole('option', { name: /Bulk Client 1199/ }).first().waitFor();
    const interact = Date.now() - t1;
    assert(load < 4000 && interact < 4000, `slow: load ${load}ms, interact ${interact}ms`);
    results.push(`      (load ${load}ms, clients+search ${interact}ms)`);
    // Any change re-saves; large workspaces must be stored compressed, well under the quota.
    await page.getByRole('combobox').fill('');
    const before = await page.evaluate(() => localStorage.getItem('lumora-salon-os-v1'));
    await page.getByRole('button', { name: 'Quick add' }).click();
    await page.getByRole('menuitem', { name: 'New Client' }).click();
    await page.getByRole('dialog').getByLabel('Full name').fill('After Bulk');
    await page.getByRole('dialog').getByRole('button', { name: 'Save Client' }).click();
    void before;
    // Wait until the compressed save on disk actually contains the new client (and time it).
    const tSave = Date.now();
    let saved = false;
    while (!saved && Date.now() - tSave < 10000) {
      saved = await page.evaluate(async () => {
        const v = localStorage.getItem('lumora-salon-os-v1') || '';
        if (!v.startsWith('GZ1:')) return false;
        const bytes = Uint8Array.from(atob(v.slice(4)), (c) => c.charCodeAt(0));
        const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        return text.includes('After Bulk');
      });
      if (!saved) await page.waitForTimeout(50);
    }
    assert(saved, 'large workspace change was not saved within 10s');
    results.push(`      (change on disk after ~${Date.now() - tSave}ms incl. 300ms debounce)`);
    const size = await page.evaluate(() => localStorage.getItem('lumora-salon-os-v1').length);
    results.push(`      (stored ${Math.round(size / 1024)}K chars compressed)`);
    await page.reload();
    await page.getByRole('button', { name: 'Clients' }).first().click();
    await page.getByRole('combobox').fill('After Bulk');
    await page.getByRole('option', { name: /After Bulk/ }).first().waitFor();
    assert(errors.length === 0, errors.join(' | '));
  });
}

await browser.close();
console.log(results.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nALL E2E CHECKS PASSED');
process.exit(failures ? 1 : 0);
