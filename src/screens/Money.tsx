import { useState } from 'react';
import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { formatDateShort, todayISO } from '../lib/dates';
import { serviceCost, serviceMargin, serviceProfit, suggestedPrice } from '../lib/pricing';
import { apptOutstanding, clientName, getAvgTicket, getExpensesThisMonth, getGiftCardLiability, getLowStockItems, getNetProfit, getOutstandingAppointments, getOutstandingTotal, getRevenueThisMonth, getServiceProfitability, getTipsThisMonth, serviceNames, servicesLeft } from '../lib/selectors';
import { isMoneyIn, paymentLabel } from '../lib/finance';
import type { MoneyTab } from '../store/types';

const TABS: MoneyTab[] = ['Overview', 'Pricing', 'Payments', 'Expenses', 'Inventory'];

export function Money() {
  const tab = useStore((s) => s.moneyTab);
  const setTab = useStore((s) => s.setMoneyTab);

  return (
    <div className="mx-auto max-w-[1150px] animate-lum-fade">
      <h1 className="mb-4 font-serif text-[28px] font-medium text-ink-900">Money</h1>
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-ivory-400 scrollbar-none">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`mr-5 min-h-[40px] flex-none border-b-2 pb-2.5 text-[14px] font-bold ${tab === t ? 'border-plum-600 text-plum-600' : 'border-transparent text-ink-400'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' && <OverviewTab />}
      {tab === 'Pricing' && <PricingTab />}
      {tab === 'Payments' && <PaymentsTab />}
      {tab === 'Expenses' && <ExpensesTab />}
      {tab === 'Inventory' && <InventoryTab />}
    </div>
  );
}

function Tile({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-[14px] border border-ivory-400 bg-white px-4 py-4">
      <div className="mb-1.5 text-[12px] text-ink-400">{label}</div>
      <div className="font-serif text-[20px] font-bold" style={{ color: color || 'var(--color-ink-900)' }}>{value}</div>
      {sub && <div className="text-[11px] text-ink-400">{sub}</div>}
    </div>
  );
}

function OverviewTab() {
  const state = useStore((s) => s);
  const cur = state.business.currencySymbol;
  const revenue = getRevenueThisMonth(state);
  const expenses = getExpensesThisMonth(state);
  const net = getNetProfit(state);
  const outstanding = getOutstandingTotal(state);
  const avgTicket = getAvgTicket(state);
  const tips = getTipsThisMonth(state);
  const profitability = getServiceProfitability(state);

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-5">
        <Tile label="Revenue this month" value={`${cur}${revenue.toFixed(0)}`} sub={`cash & card received${tips > 0 ? ` · incl. ${cur}${tips.toFixed(0)} tips` : ''}`} />
        <Tile label="Expenses this month" value={`${cur}${expenses.toFixed(0)}`} />
        <Tile label="Net Profit" value={`${cur}${net.toFixed(0)}`} color={net >= 0 ? 'var(--color-good-600)' : 'var(--color-bad-600)'} />
        <Tile label="Outstanding" value={`${cur}${outstanding.toFixed(0)}`} color="var(--color-bad-600)" />
        <Tile label="Avg Ticket" value={`${cur}${avgTicket.toFixed(0)}`} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="border-b border-ivory-400 px-5 py-3.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Service Profitability</div>
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-5 py-2.5 text-[11px] font-bold uppercase text-ink-400 md:grid">
          <span>Service</span><span>Cost</span><span>Price</span><span>Profit</span><span>Margin</span>
        </div>
        {profitability.map(({ service, cost, profit, margin }) => (
          <div key={service.id} className="grid grid-cols-2 items-center gap-2 border-t border-ivory-200 px-5 py-3 text-[13.5px] md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <span className="col-span-2 font-semibold text-ink-900 md:col-span-1">{service.name}</span>
            <span className="text-ink-500">{cur}{cost.toFixed(0)}</span>
            <span className="text-ink-500">{cur}{service.price.toFixed(0)}</span>
            <span className="font-semibold text-good-600">{cur}{profit.toFixed(0)}</span>
            <span className="font-bold" style={{ color: margin >= service.targetMargin ? 'var(--color-good-600)' : 'var(--color-warn-500)' }}>{(margin * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingTab() {
  const state = useStore((s) => s);
  const updateField = useStore((s) => s.updateServiceField);
  const moveService = useStore((s) => s.moveService);
  const duplicateService = useStore((s) => s.duplicateService);
  const archiveToggle = useStore((s) => s.archiveToggleService);
  const addService = useStore((s) => s.addService);
  const setPricingServiceId = useStore((s) => s.setPricingServiceId);

  return (
    <div>
      <div className="mb-5 overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Your Services</div>
          <button onClick={addService} className="rounded-lg bg-plum-600 px-3.5 py-2 text-[12.5px] font-bold text-white">+ Add Service</button>
        </div>
        <div className="hidden grid-cols-[2fr_1fr_0.8fr_0.8fr_2.2fr] gap-2 px-5 py-2.5 text-[11px] font-bold uppercase text-ink-400 md:grid">
          <span>Name</span><span>Category</span><span>Duration</span><span>Price</span><span>Actions</span>
        </div>
        {state.services.map((sv) => (
          <div key={sv.id} className="grid grid-cols-1 gap-2 border-t border-ivory-200 px-5 py-3 md:grid-cols-[2fr_1fr_0.8fr_0.8fr_2.2fr] md:items-center" style={{ opacity: sv.active ? 1 : 0.5 }}>
            <input aria-label="Service name" value={sv.name} onChange={(e) => updateField(sv.id, 'name', e.target.value)} onBlur={(e) => !e.target.value.trim() && updateField(sv.id, 'name', 'Service')} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[13px] font-semibold" />
            <input aria-label="Category" value={sv.category} onChange={(e) => updateField(sv.id, 'category', e.target.value)} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[12.5px]" />
            <input aria-label="Duration in minutes" type="number" inputMode="numeric" min={5} value={sv.duration} onChange={(e) => updateField(sv.id, 'duration', Number(e.target.value))} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[12.5px]" />
            <input aria-label="Price" type="number" inputMode="decimal" min={0} value={sv.price} onChange={(e) => updateField(sv.id, 'price', Number(e.target.value))} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[12.5px]" />
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => moveService(sv.id, -1)} aria-label={`Move ${sv.name} up`} className="min-h-[32px] rounded-md border border-ivory-300 px-2.5 py-1 text-[11px]">↑</button>
              <button onClick={() => moveService(sv.id, 1)} aria-label={`Move ${sv.name} down`} className="min-h-[32px] rounded-md border border-ivory-300 px-2.5 py-1 text-[11px]">↓</button>
              <button onClick={() => { useStore.getState().setMoneyTab('Pricing'); setPricingServiceId(sv.id); document.getElementById('pricing-calc')?.scrollIntoView({ behavior: 'smooth' }); }} className="rounded-md bg-plum-100 px-2 py-1 text-[11px] font-bold text-plum-600">
                Analyze Profitability
              </button>
              <button onClick={() => duplicateService(sv.id)} className="rounded-md border border-ivory-300 px-2 py-1 text-[11px] font-semibold">Duplicate</button>
              <button onClick={() => archiveToggle(sv.id)} className="rounded-md border border-ivory-300 px-2 py-1 text-[11px] font-semibold">{sv.active ? 'Archive' : 'Restore'}</button>
              {!sv.active && <span className="self-center text-[11px] font-bold uppercase text-ink-400">Archived</span>}
            </div>
          </div>
        ))}
      </div>
      <PricingCalculator />
    </div>
  );
}

function PricingCalculator() {
  const state = useStore((s) => s);
  const cur = state.business.currencySymbol;
  const id = useStore((s) => s.pricingServiceId);
  const setId = useStore((s) => s.setPricingServiceId);
  const updateField = useStore((s) => s.updateServiceField);
  const applySuggested = useStore((s) => s.applySuggestedPrice);
  const sv = state.services.find((s) => s.id === id) || state.services[0];
  if (!sv) return null;

  const cost = serviceCost(sv);
  const profit = serviceProfit(sv.price, cost);
  const margin = serviceMargin(sv.price, cost);
  const suggested = suggestedPrice(cost, sv.targetMargin);
  const belowTarget = margin < sv.targetMargin;

  return (
    <div id="pricing-calc" className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="rounded-2xl border border-ivory-400 bg-white p-6">
        <div className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Smart Service Pricing</div>
        <select value={sv.id} onChange={(e) => setId(e.target.value)} className="mb-4 w-full rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[13.5px] font-semibold">
          {state.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (archived)'}</option>
          ))}
        </select>
        <div className="flex flex-col gap-3.5">
          <NumField label={`Material cost (${cur})`} value={sv.materials} onChange={(v) => updateField(sv.id, 'materials', v)} />
          <NumField label="Labor hours" value={sv.laborHours} step={0.1} onChange={(v) => updateField(sv.id, 'laborHours', v)} />
          <NumField label={`Hourly labor cost (${cur})`} value={sv.hourlyRate} onChange={(v) => updateField(sv.id, 'hourlyRate', v)} />
          <NumField label={`Overhead allocation (${cur})`} value={sv.overhead} onChange={(v) => updateField(sv.id, 'overhead', v)} />
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Clients should rebook every
            <select value={sv.rebookWeeks || 0} onChange={(e) => updateField(sv.id, 'rebookWeeks', Number(e.target.value))} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px] font-normal">
              <option value={0}>Business default ({state.business.rebookWeeks} weeks)</option>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 26].map((w) => (
                <option key={w} value={w}>{w} week{w === 1 ? '' : 's'}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Target margin ({(sv.targetMargin * 100).toFixed(0)}%)
            <input type="range" min={10} max={70} value={sv.targetMargin * 100} onChange={(e) => updateField(sv.id, 'targetMargin', Number(e.target.value) / 100)} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-ivory-400 bg-white p-6">
        <div className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Breakdown</div>
        <div className="mb-4 flex flex-col gap-1.5 text-[13.5px]">
          <Row label="Materials" value={`${cur}${sv.materials.toFixed(2)}`} />
          <Row label={`Labor (${sv.laborHours}h × ${cur}${sv.hourlyRate})`} value={`${cur}${(sv.laborHours * sv.hourlyRate).toFixed(2)}`} />
          <Row label="Overhead" value={`${cur}${sv.overhead.toFixed(2)}`} />
          <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1.5 font-bold text-ink-900"><span>Service cost</span><span>{cur}{cost.toFixed(2)}</span></div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-[10px] bg-ivory-100 px-3 py-2.5 text-center">
            <div className="text-[10.5px] text-ink-400">Current price</div>
            <div className="text-[15px] font-bold text-ink-900">{cur}{sv.price.toFixed(2)}</div>
          </div>
          <div className="rounded-[10px] bg-ivory-100 px-3 py-2.5 text-center">
            <div className="text-[10.5px] text-ink-400">Profit</div>
            <div className="text-[15px] font-bold text-good-600">{cur}{profit.toFixed(2)}</div>
          </div>
          <div className="rounded-[10px] bg-ivory-100 px-3 py-2.5 text-center">
            <div className="text-[10.5px] text-ink-400">Margin</div>
            <div className="text-[15px] font-bold" style={{ color: belowTarget ? 'var(--color-warn-500)' : 'var(--color-good-600)' }}>{(margin * 100).toFixed(1)}%</div>
          </div>
        </div>
        {belowTarget ? (
          <div className="rounded-xl border border-warn-100 bg-warn-100/50 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-warn-600"><Icon name="alert" size={14} /> Below your {(sv.targetMargin * 100).toFixed(0)}% target margin</div>
            <p className="mb-2.5 text-[12.5px] text-ink-500">Suggested price: <b className="text-ink-900">{cur}{Number.isFinite(suggested) ? suggested.toFixed(2) : '—'}</b></p>
            <button onClick={() => applySuggested(sv.id)} className="rounded-lg bg-plum-600 px-3.5 py-2 text-[12.5px] font-bold text-white">Apply Suggested Price</button>
          </div>
        ) : (
          <div className="rounded-xl border border-good-100 bg-good-100/50 p-3.5 text-[13px] font-semibold text-good-600">
            <Icon name="check" size={14} className="mr-1 inline" /> Meeting your target margin.
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
      {label}
      <input type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px] font-normal" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-ink-500"><span>{label}</span><span className="font-semibold text-ink-900">{value}</span></div>;
}

function PaymentsTab() {
  const state = useStore((s) => s);
  const voidPayment = useStore((s) => s.voidPayment);
  const openRecordPayment = useStore((s) => s.openRecordPayment);
  const cur = state.business.currencySymbol;
  const [limit, setLimit] = useState(100);
  const sorted = [...state.payments].sort((a, b) => b.date.localeCompare(a.date));
  const total = sorted.filter(isMoneyIn).reduce((sum, p) => sum + p.amount, 0);
  const unpaid = getOutstandingAppointments(state);
  const voidGiftCard = useStore((s) => s.voidGiftCard);
  const cards = [...state.giftCards].sort((a, b) => Number(!!a.voided) - Number(!!b.voided) || Number(a.balance <= 0) - Number(b.balance <= 0) || b.issuedDate.localeCompare(a.issuedDate));
  const [showUsedCards, setShowUsedCards] = useState(false);
  const liability = getGiftCardLiability(state);
  const visibleCards = showUsedCards ? cards : cards.filter((c) => !c.voided && c.balance > 0);

  return (
    <div className="flex flex-col gap-5">
      {unpaid.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-bad-100 bg-white">
          <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
            <div className="text-[11.5px] font-bold uppercase tracking-wide text-bad-600">Unpaid Visits</div>
            <div className="text-[13px] font-bold text-bad-600">{cur}{getOutstandingTotal(state).toFixed(2)} owed</div>
          </div>
          {unpaid.slice(0, 20).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ivory-200 px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold text-ink-900">{clientName(state, a.clientId)}</div>
                <div className="text-[12px] text-ink-400">{formatDateShort(a.date)} · {serviceNames(state, a.serviceIds)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-bad-600">{cur}{apptOutstanding(state, a).toFixed(2)}</span>
                <button onClick={() => openRecordPayment(a.clientId, a.id)} className="min-h-[36px] rounded-md bg-plum-600 px-3 text-[12px] font-bold text-white">Record Payment</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ivory-400 px-5 py-3.5">
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Gift Cards &amp; Store Credit</div>
            <div className="text-[12px] text-ink-400">{liability > 0 ? `${cur}${liability.toFixed(2)} unspent — owed to clients as services` : 'Nothing unspent'}</div>
          </div>
          <button onClick={() => openRecordPayment(undefined, undefined, 'gift-card')} className="min-h-[36px] rounded-md bg-plum-600 px-3 text-[12px] font-bold text-white">+ Sell Gift Card</button>
        </div>
        {visibleCards.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-400">{cards.length ? 'All gift cards have been used.' : 'No gift cards yet. Sold cards and store credit appear here and can be used at checkout.'}</div>
        ) : (
          visibleCards.slice(0, 50).map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-ivory-200 px-5 py-3 ${c.voided || c.balance <= 0 ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold text-ink-900">{c.code} <span className="font-semibold text-ink-400">· {c.kind === 'credit' ? 'Store credit' : 'Gift card'}</span></div>
                <div className="text-[12px] text-ink-400">{c.clientId ? clientName(state, c.clientId) : c.purchasedBy || '—'} · issued {formatDateShort(c.issuedDate)}{c.voided ? (c.kind === 'credit' ? ' · refunded' : ' · voided') : ''}</div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className={`text-[14px] font-bold ${c.voided ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{cur}{c.balance.toFixed(2)}<span className="text-[12px] font-semibold text-ink-400"> / {cur}{c.initialValue.toFixed(2)}</span></span>
                {!c.voided && Math.abs(c.balance - c.initialValue) < 0.005 && (
                  <button onClick={() => voidGiftCard(c.id)} className="min-h-[32px] rounded-md border border-ivory-300 px-2 text-[11px] font-semibold text-ink-400 hover:border-bad-500 hover:text-bad-500">{c.kind === 'credit' ? 'Refund' : 'Void'}</button>
                )}
              </div>
            </div>
          ))
        )}
        {cards.some((c) => c.voided || c.balance <= 0) && (
          <button onClick={() => setShowUsedCards(!showUsedCards)} className="min-h-[44px] w-full border-t border-ivory-200 text-[12.5px] font-bold text-plum-600">{showUsedCards ? 'Hide used & voided cards' : 'Show used & voided cards'}</button>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">All Payments</div>
          <div className="text-[13px] font-bold text-ink-900">{cur}{total.toFixed(2)} received</div>
        </div>
        {sorted.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-400">No payments recorded yet. Payments appear here when you check out a client or record one.</div>
        ) : (
          sorted.slice(0, limit).map((p) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 border-t border-ivory-200 px-5 py-3 ${p.voided ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold text-ink-900">{clientName(state, p.clientId)}</div>
                <div className="text-[12px] text-ink-400"><span className="capitalize">{paymentLabel(p)}</span> · {p.method} · {formatDateShort(p.date)}{p.tip ? ` · incl. ${cur}${p.tip.toFixed(2)} tip` : ''}{p.note ? ` · ${p.note}` : ''}{p.voided ? ' · voided' : ''}</div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className={`text-[14px] font-bold ${p.voided ? 'text-ink-400 line-through' : p.method === 'Gift card' ? 'text-ink-500' : 'text-good-600'}`} title={p.method === 'Gift card' ? 'Paid from a gift card / credit — not new money' : undefined}>{p.method === 'Gift card' ? '' : '+'}{cur}{p.amount.toFixed(2)}</span>
                {!p.voided && <button onClick={() => voidPayment(p.id)} aria-label={`Void ${cur}${p.amount.toFixed(2)} payment`} className="min-h-[32px] rounded-md border border-ivory-300 px-2 text-[11px] font-semibold text-ink-400 hover:border-bad-500 hover:text-bad-500">Void</button>}
              </div>
            </div>
          ))
        )}
        {sorted.length > limit && (
          <button onClick={() => setLimit(limit + 200)} className="min-h-[48px] w-full border-t border-ivory-200 text-[13px] font-bold text-plum-600">Show more ({sorted.length - limit} more)</button>
        )}
      </div>
    </div>
  );
}

const EXPENSE_CATEGORIES = ['Rent', 'Supplies', 'Marketing', 'Utilities', 'Software', 'Education', 'Other'];

function ExpensesTab() {
  const state = useStore((s) => s);
  const cur = state.business.currencySymbol;
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const [form, setForm] = useState({ name: '', category: 'Supplies', amount: '', date: todayISO() });
  const [limit, setLimit] = useState(100);

  const sorted = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const monthTotal = getExpensesThisMonth(state);

  const submit = () => {
    const ok = addExpense({ name: form.name, category: form.category, amount: Number(form.amount), date: form.date || todayISO() });
    if (ok) setForm({ name: '', category: form.category, amount: '', date: todayISO() });
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mb-5 grid grid-cols-2 gap-2.5 rounded-2xl border border-ivory-400 bg-white p-4 sm:flex sm:flex-wrap sm:items-end">
        <input aria-label="Expense name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Expense name" className="col-span-2 min-w-[160px] flex-1 rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" />
        <select aria-label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px]">
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input aria-label="Amount" type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={`Amount (${cur})`} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px] sm:w-32" />
        <input aria-label="Date" type="date" max={todayISO()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-[10px] border border-ivory-400 px-3 py-2.5 text-[14px]" />
        <button type="submit" className="min-h-[44px] rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Add Expense</button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Expenses</div>
          <div className="text-[13px] font-bold text-ink-900">{cur}{monthTotal.toFixed(2)} this month</div>
        </div>
        {sorted.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-ink-400">No expenses yet. Add rent, supplies and other costs to see your real profit.</div>}
        {sorted.slice(0, limit).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 border-t border-ivory-200 px-5 py-3">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-bold text-ink-900">{e.name}</div>
              <div className="text-[12px] text-ink-400">{e.category} · {formatDateShort(e.date)}</div>
            </div>
            <div className="flex flex-none items-center gap-2">
              <span className="text-[14px] font-bold text-ink-900">{cur}{e.amount.toFixed(2)}</span>
              <button onClick={() => deleteExpense(e.id)} aria-label={`Delete expense ${e.name}`} className="flex h-9 w-9 items-center justify-center text-ink-300 hover:text-bad-500"><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {sorted.length > limit && (
          <button onClick={() => setLimit(limit + 200)} className="min-h-[48px] w-full border-t border-ivory-200 text-[13px] font-bold text-plum-600">Show more ({sorted.length - limit} more)</button>
        )}
      </div>
    </div>
  );
}

function InventoryTab() {
  const state = useStore((s) => s);
  const addItem = useStore((s) => s.addInventoryItem);
  const low = getLowStockItems(state);

  return (
    <div>
      {low.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-warn-100 bg-warn-100/50 px-4 py-3 text-[13px] font-semibold text-warn-600">
          <Icon name="alert" size={15} /> {low.length} item{low.length === 1 ? '' : 's'} at or below reorder level: {low.slice(0, 3).map((i) => i.name).join(', ')}{low.length > 3 ? '…' : ''}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Products &amp; Supplies</div>
          <button
            onClick={() => addItem({ name: 'New Item', qty: 0, unit: 'unit', cost: 0, retailPrice: 0, supplier: '', reorderLevel: 5, expiration: null, usagePerService: {} })}
            className="min-h-[40px] rounded-lg bg-plum-600 px-3.5 py-2 text-[12.5px] font-bold text-white"
          >
            + Add Item
          </button>
        </div>
        {state.inventory.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-ink-400">No products yet. Add supplies (deducted automatically when linked to a service) and retail products (sold at checkout).</div>
        )}
        {state.inventory.map((item) => (
          <InventoryRow key={item.id} itemId={item.id} />
        ))}
      </div>
    </div>
  );
}

function InventoryRow({ itemId }: { itemId: string }) {
  const item = useStore((s) => s.inventory.find((i) => i.id === itemId));
  const services = useStore((s) => s.services);
  const cur = useStore((s) => s.business.currencySymbol);
  const updateField = useStore((s) => s.updateInventoryField);
  const setUsage = useStore((s) => s.setInventoryUsage);
  const restock = useStore((s) => s.restockInventory);
  const deleteItem = useStore((s) => s.deleteInventoryItem);
  const [restockQty, setRestockQty] = useState('');
  const [showUsage, setShowUsage] = useState(false);
  if (!item) return null;
  const lowFlag = item.qty <= item.reorderLevel;
  const left = servicesLeft(item);
  const linked = Object.keys(item.usagePerService).length;
  const small = 'rounded-lg border border-ivory-300 px-2 py-1.5 text-[13px]';

  return (
    <div className="border-t border-ivory-200 px-5 py-3.5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr_1.6fr] md:items-end">
        <label className="col-span-2 flex flex-col gap-1 text-[11px] font-bold text-ink-400 md:col-span-1">
          Name
          <input value={item.name} onChange={(e) => updateField(item.id, 'name', e.target.value)} className={`${small} font-semibold text-ink-900`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-400">
          In stock ({item.unit})
          <input type="number" inputMode="decimal" min={0} value={item.qty} onChange={(e) => updateField(item.id, 'qty', Number(e.target.value))} className={`${small} font-normal text-ink-900`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-400">
          Reorder at
          <input type="number" inputMode="decimal" min={0} value={item.reorderLevel} onChange={(e) => updateField(item.id, 'reorderLevel', Number(e.target.value))} className={`${small} font-normal text-ink-900`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-400">
          Retail price ({cur})
          <input type="number" inputMode="decimal" min={0} value={item.retailPrice} onChange={(e) => updateField(item.id, 'retailPrice', Number(e.target.value))} className={`${small} font-normal text-ink-900`} />
        </label>
        <form
          className="col-span-2 flex items-end gap-1.5 md:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            restock(item.id, Number(restockQty));
            setRestockQty('');
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-bold text-ink-400">
            Received
            <input type="number" inputMode="decimal" min={0} value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder={`+ ${item.unit}`} className={`${small} font-normal text-ink-900`} />
          </label>
          <button type="submit" className="min-h-[36px] flex-none rounded-md border border-ivory-300 px-2.5 text-[11.5px] font-semibold hover:border-plum-600 hover:text-plum-600">Restock</button>
        </form>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span style={{ color: lowFlag ? 'var(--color-bad-600)' : 'var(--color-ink-500)' }} className="font-semibold">
          {lowFlag ? 'Low stock — reorder' : 'In stock'}{left !== null ? ` · ~${left} services left` : ''}
        </span>
        {item.retailPrice > 0 && <span className="text-ink-400">Sold at checkout</span>}
        <button onClick={() => setShowUsage(!showUsage)} aria-expanded={showUsage} className="min-h-[32px] font-semibold text-plum-600">
          {linked ? `Used in ${linked} service${linked === 1 ? '' : 's'}` : 'Link to services'} {showUsage ? '▲' : '▼'}
        </button>
        <div className="flex-1" />
        <button onClick={() => deleteItem(item.id)} className="min-h-[32px] rounded-md border border-ivory-300 px-2.5 text-[11px] text-ink-400 hover:border-bad-500 hover:text-bad-500">Remove</button>
      </div>
      {showUsage && (
        <div className="mt-2 rounded-xl bg-ivory-100 p-3">
          <p className="mb-2 text-[12px] text-ink-500">Amount used per service (in {item.unit}). It's deducted automatically at checkout.</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {services.filter((sv) => sv.active || item.usagePerService[sv.id]).map((sv) => (
              <label key={sv.id} className="flex items-center justify-between gap-2 text-[12.5px] text-ink-700">
                <span className="min-w-0 truncate">{sv.name}</span>
                <input type="number" inputMode="decimal" min={0} step="any" value={item.usagePerService[sv.id] ?? ''} placeholder="0" onChange={(e) => setUsage(item.id, sv.id, Number(e.target.value))} className="w-20 rounded-md border border-ivory-300 bg-white px-2 py-1.5 text-[12.5px]" />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
