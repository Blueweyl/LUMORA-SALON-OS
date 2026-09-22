import { useState } from 'react';
import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { formatDateShort } from '../lib/dates';
import { serviceCost, serviceMargin, serviceProfit, suggestedPrice } from '../lib/pricing';
import { getAvgTicket, getExpensesThisMonth, getLowStockItems, getNetProfit, getOutstandingTotal, getRevenueThisMonth, getServiceProfitability, servicesLeft } from '../lib/selectors';
import type { MoneyTab } from '../store/types';

const TABS: MoneyTab[] = ['Overview', 'Pricing', 'Payments', 'Expenses', 'Inventory'];

export function Money() {
  const tab = useStore((s) => s.moneyTab);
  const setTab = useStore((s) => s.setMoneyTab);

  return (
    <div className="mx-auto max-w-[1150px] animate-lum-fade">
      <h1 className="mb-4 font-serif text-[28px] font-medium text-ink-900">Money</h1>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-ivory-400">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`mr-5 border-b-2 pb-2.5 text-[14px] font-bold ${tab === t ? 'border-plum-600 text-plum-600' : 'border-transparent text-ink-400'}`}>
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

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[14px] border border-ivory-400 bg-white px-4 py-4">
      <div className="mb-1.5 text-[12px] text-ink-400">{label}</div>
      <div className="font-serif text-[20px] font-bold" style={{ color: color || 'var(--color-ink-900)' }}>{value}</div>
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
  const profitability = getServiceProfitability(state);

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-5">
        <Tile label="Revenue" value={`${cur}${revenue.toFixed(0)}`} />
        <Tile label="Expenses" value={`${cur}${expenses.toFixed(0)}`} />
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
            <input value={sv.name} onChange={(e) => updateField(sv.id, 'name', e.target.value)} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[13px] font-semibold" />
            <input value={sv.category} onChange={(e) => updateField(sv.id, 'category', e.target.value)} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[12.5px]" />
            <input type="number" value={sv.duration} onChange={(e) => updateField(sv.id, 'duration', Number(e.target.value))} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[12.5px]" />
            <input type="number" value={sv.price} onChange={(e) => updateField(sv.id, 'price', Number(e.target.value))} className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[12.5px]" />
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => moveService(sv.id, -1)} className="rounded-md border border-ivory-300 px-2 py-1 text-[11px]">↑</button>
              <button onClick={() => moveService(sv.id, 1)} className="rounded-md border border-ivory-300 px-2 py-1 text-[11px]">↓</button>
              <button onClick={() => { useStore.getState().setMoneyTab('Pricing'); setPricingServiceId(sv.id); document.getElementById('pricing-calc')?.scrollIntoView({ behavior: 'smooth' }); }} className="rounded-md bg-plum-100 px-2 py-1 text-[11px] font-bold text-plum-600">
                Analyze Profitability
              </button>
              <button onClick={() => duplicateService(sv.id)} className="rounded-md border border-ivory-300 px-2 py-1 text-[11px] font-semibold">Duplicate</button>
              <button onClick={() => archiveToggle(sv.id)} className="rounded-md border border-ivory-300 px-2 py-1 text-[11px] font-semibold">{sv.active ? 'Archive' : 'Unarchive'}</button>
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
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex flex-col gap-3.5">
          <NumField label={`Material cost (${cur})`} value={sv.materials} onChange={(v) => updateField(sv.id, 'materials', v)} />
          <NumField label="Labor hours" value={sv.laborHours} step={0.1} onChange={(v) => updateField(sv.id, 'laborHours', v)} />
          <NumField label={`Hourly labor cost (${cur})`} value={sv.hourlyRate} onChange={(v) => updateField(sv.id, 'hourlyRate', v)} />
          <NumField label={`Overhead allocation (${cur})`} value={sv.overhead} onChange={(v) => updateField(sv.id, 'overhead', v)} />
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
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px] font-normal" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-ink-500"><span>{label}</span><span className="font-semibold text-ink-900">{value}</span></div>;
}

function PaymentsTab() {
  const state = useStore((s) => s);
  const cur = state.business.currencySymbol;
  const sorted = [...state.payments].sort((a, b) => b.date.localeCompare(a.date));
  const total = sorted.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
      <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
        <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">All Payments</div>
        <div className="text-[13px] font-bold text-ink-900">{cur}{total.toFixed(0)} total</div>
      </div>
      {sorted.length === 0 ? (
        <div className="px-5 py-10 text-center text-[13px] text-ink-400">No payments recorded yet.</div>
      ) : (
        sorted.map((p) => {
          const client = state.clients.find((c) => c.id === p.clientId);
          return (
            <div key={p.id} className="flex items-center justify-between border-t border-ivory-200 px-5 py-3">
              <div>
                <div className="text-[13.5px] font-bold text-ink-900">{client?.name || 'Client'}</div>
                <div className="text-[12px] capitalize text-ink-400">{p.type.replace('-', ' ')} · {p.method} · {formatDateShort(p.date)}</div>
              </div>
              <span className="text-[14px] font-bold text-good-600">+{cur}{p.amount.toFixed(0)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = ['Rent', 'Supplies', 'Marketing', 'Utilities', 'Software', 'Education', 'Other'];

function ExpensesTab() {
  const state = useStore((s) => s);
  const cur = state.business.currencySymbol;
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const [form, setForm] = useState({ name: '', category: 'Supplies', amount: '' });

  const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);

  const submit = () => {
    if (!form.name || !form.amount) return;
    addExpense({ name: form.name, category: form.category, amount: Number(form.amount), date: new Date().toISOString().slice(0, 10) });
    setForm({ name: '', category: 'Supplies', amount: '' });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-2.5 rounded-2xl border border-ivory-400 bg-white p-4">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Expense name" className="min-w-[160px] flex-1 rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[13.5px]" />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[13.5px]">
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" className="w-28 rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[13.5px]" />
        <button onClick={submit} className="rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Add Expense</button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">This Month</div>
          <div className="text-[13px] font-bold text-ink-900">{cur}{total.toFixed(0)} total</div>
        </div>
        {state.expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-t border-ivory-200 px-5 py-3">
            <div>
              <div className="text-[13.5px] font-bold text-ink-900">{e.name}</div>
              <div className="text-[12px] text-ink-400">{e.category} · {formatDateShort(e.date)}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-bold text-ink-900">{cur}{e.amount.toFixed(0)}</span>
              <button onClick={() => deleteExpense(e.id)} className="text-ink-300 hover:text-bad-500"><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryTab() {
  const state = useStore((s) => s);
  const updateField = useStore((s) => s.updateInventoryField);
  const restock = useStore((s) => s.restockInventory);
  const deleteItem = useStore((s) => s.deleteInventoryItem);
  const addItem = useStore((s) => s.addInventoryItem);
  const low = getLowStockItems(state);

  return (
    <div>
      {low.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-warn-100 bg-warn-100/50 px-4 py-3 text-[13px] font-semibold text-warn-600">
          <Icon name="alert" size={15} /> {low.length} item{low.length === 1 ? '' : 's'} at or below reorder level.
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="flex items-center justify-between border-b border-ivory-400 px-5 py-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Products &amp; Supplies</div>
          <button
            onClick={() => addItem({ name: 'New Item', qty: 0, unit: 'unit', cost: 0, retailPrice: 0, supplier: '', reorderLevel: 5, expiration: null, usagePerService: {} })}
            className="rounded-lg bg-plum-600 px-3.5 py-2 text-[12.5px] font-bold text-white"
          >
            + Add Item
          </button>
        </div>
        {state.inventory.map((item) => {
          const lowFlag = item.qty <= item.reorderLevel;
          const left = servicesLeft(item);
          return (
            <div key={item.id} className="grid grid-cols-1 gap-2 border-t border-ivory-200 px-5 py-3 md:grid-cols-[1.6fr_0.8fr_0.8fr_1fr_1.4fr] md:items-center">
              <div>
                <input value={item.name} onChange={(e) => updateField(item.id, 'name', e.target.value)} className="w-full rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[13px] font-semibold" />
                <div className="mt-0.5 text-[11px] text-ink-400">{item.supplier}</div>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" value={item.qty} onChange={(e) => updateField(item.id, 'qty', Number(e.target.value))} className="w-16 rounded-lg border border-ivory-300 px-2 py-1.5 text-[12.5px]" />
                <span className="text-[11.5px] text-ink-400">{item.unit}</span>
              </div>
              <div className="text-[12.5px] text-ink-500">Reorder @ {item.reorderLevel}</div>
              <div className="text-[12px]" style={{ color: lowFlag ? 'var(--color-bad-600)' : 'var(--color-ink-500)' }}>
                {lowFlag ? 'Low stock' : 'In stock'}{left !== null ? ` · ~${left} services left` : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => restock(item.id, 100)} className="rounded-md border border-ivory-300 px-2.5 py-1 text-[11px] font-semibold">+ Restock</button>
                <button onClick={() => deleteItem(item.id)} className="rounded-md border border-ivory-300 px-2.5 py-1 text-[11px] text-ink-400 hover:border-bad-500 hover:text-bad-500">Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
