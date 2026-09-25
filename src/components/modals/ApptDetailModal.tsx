import type { ReactNode } from 'react';
import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { Icon } from '../icons';
import { Pill } from '../ui/Badge';
import { apptBill, apptOutstanding, apptPaid, apptTotal, clientName, getServices, inventoryUsage, servicesLeft, staffName } from '../../lib/selectors';
import { formatDateLong, formatDuration, formatTime, todayISO } from '../../lib/dates';
import { statusMeta } from '../../lib/status';

export function ApptDetailModal() {
  const apptId = useStore((s) => s.apptDetailId);
  const state = useStore((s) => s);
  const close = useStore((s) => s.closeApptDetail);
  const apptAction = useStore((s) => s.apptAction);
  const openClient = useStore((s) => s.openClient);
  const openReschedule = useStore((s) => s.openReschedule);
  const openRecordPayment = useStore((s) => s.openRecordPayment);
  const rebookClient = useStore((s) => s.rebookClient);
  const updateTip = useStore((s) => s.updateCheckoutTip);
  const setPayMethod = useStore((s) => s.setCheckoutPayMethod);
  const setProductQty = useStore((s) => s.setCheckoutProductQty);
  const completeCheckout = useStore((s) => s.completeCheckout);
  const checkout = useStore((s) => s.checkoutDraft);

  const appt = state.appointments.find((a) => a.id === apptId);
  if (!appt) return null;

  const cur = state.business.currencySymbol;
  const client = state.clients.find((c) => c.id === appt.clientId);
  const services = getServices(state, appt.serviceIds);
  const meta = statusMeta(appt.status);
  const isOpen = ['unconfirmed', 'confirmed', 'checked-in', 'in-service'].includes(appt.status);
  const isFuture = appt.date > todayISO();
  const canCheckout = ['confirmed', 'checked-in', 'in-service'].includes(appt.status) && !isFuture;
  const paid = apptPaid(state, appt.id);

  const usage = inventoryUsage(state.inventory, appt.serviceIds);
  const usageList = Object.entries(usage)
    .map(([itemId, amt]) => ({ item: state.inventory.find((i) => i.id === itemId), amt }))
    .filter((x): x is { item: NonNullable<typeof x.item>; amt: number } => Boolean(x.item));
  const retailProducts = state.inventory.filter((i) => i.retailPrice > 0);
  const productsTotal = Object.entries(checkout.productSelections).reduce((sum, [itemId, qty]) => {
    const item = state.inventory.find((i) => i.id === itemId);
    return sum + (item ? item.retailPrice * qty : 0);
  }, 0);
  const servicesTotal = apptTotal(appt);
  const balance = Math.max(0, servicesTotal - paid);
  const chargeNow = Math.round((Math.max(0, servicesTotal + productsTotal - paid) + checkout.tip) * 100) / 100;
  const owed = apptOutstanding(state, appt);
  const money = (n: number) => `${cur}${n.toFixed(2)}`;

  return (
    <Modal onClose={close} maxWidth={480} labelledBy="appt-detail-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <ModalTitle id="appt-detail-title">{canCheckout && appt.status !== 'confirmed' ? 'Checkout' : 'Appointment'}</ModalTitle>
        <Pill bg={meta.bg} color={meta.color}>{meta.label}</Pill>
      </div>

      <button onClick={() => { close(); openClient(appt.clientId); }} disabled={!client} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-ivory-400 p-3 text-left hover:border-plum-600 disabled:hover:border-ivory-400">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-plum-100 text-[13px] font-bold text-plum-600">
          {clientName(state, appt.clientId).split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold text-ink-900">{clientName(state, appt.clientId)}{client?.archived ? ' (archived)' : ''}</div>
          <div className="truncate text-[12px] text-ink-400">{services.map((s) => s.name).join(' + ') || 'Service'}</div>
        </div>
        {client && <Icon name="chevron-right" size={15} className="text-ink-400" />}
      </button>

      {client?.beautyProfile.allergies && client.beautyProfile.allergies !== 'None known' && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-warn-100 bg-warn-100/50 px-3 py-2 text-[12.5px] font-semibold text-warn-600">
          <Icon name="alert" size={13} /> Allergies: {client.beautyProfile.allergies}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
          <div className="text-[11px] text-ink-400">When</div>
          <div className="font-semibold text-ink-900">{formatDateLong(appt.date)}, {formatTime(appt.time)}</div>
        </div>
        <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
          <div className="text-[11px] text-ink-400">Staff · Duration</div>
          <div className="font-semibold text-ink-900">{staffName(state, appt.staffId)} · {formatDuration(appt.durationMin)}</div>
        </div>
      </div>

      {appt.notes && <div className="mb-4 rounded-[10px] border border-ivory-400 p-3 text-[13px] text-ink-500"><b className="text-ink-700">Notes:</b> {appt.notes}</div>}
      {appt.cancelReason && appt.status === 'cancelled' && <div className="mb-4 text-[12.5px] text-ink-400">Reason: {appt.cancelReason}</div>}

      {!canCheckout ? (
        <div className="mb-2 flex flex-col gap-1 rounded-[10px] bg-ivory-100 px-3.5 py-3 text-[13px]">
          <Line label="Services" value={money(appt.price)} />
          {appt.discount > 0 && <Line label="Discount" value={`−${money(appt.discount)}`} />}
          {appt.productsSold.map((l) => (
            <Line key={l.itemId} label={`${l.name ?? 'Product'} × ${l.qty}`} value={money(l.qty * l.price)} />
          ))}
          {appt.tip > 0 && <Line label="Tip" value={money(appt.tip)} />}
          <Line label="Paid so far" value={money(paid + (appt.status === 'completed' ? appt.tip : 0))} />
          {appt.status === 'completed' ? (
            <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1.5 text-[14px] font-bold" style={{ color: owed > 0 ? 'var(--color-bad-600)' : 'var(--color-good-600)' }}>
              <span>{owed > 0 ? 'Still owed' : 'Paid in full'}</span>
              <span>{owed > 0 ? money(owed) : money(apptBill(appt) + appt.tip)}</span>
            </div>
          ) : (
            <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1.5 text-[14px] font-bold text-ink-900"><span>Balance at checkout</span><span>{money(balance)}</span></div>
          )}
          {isOpen && isFuture && <p className="mt-1 text-[12px] text-ink-400">Check-in and checkout open on the day of the appointment.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-ivory-300 pt-4">
          {usageList.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-bold text-ink-500">Supplies used this visit (deducted at checkout)</div>
              <div className="flex flex-col gap-1">
                {usageList.map(({ item, amt }) => {
                  const remaining = Math.round((item.qty - amt) * 100) / 100;
                  const left = servicesLeft({ ...item, qty: Math.max(0, remaining) });
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="text-ink-700">{item.name} <span className="text-ink-400">−{amt}{item.unit}</span></span>
                      <span className={remaining < 0 ? 'font-semibold text-bad-600' : remaining <= item.reorderLevel ? 'text-warn-600' : 'text-ink-400'}>
                        {remaining < 0 ? 'Not enough in stock' : `${remaining}${item.unit} left${left !== null ? ` · ~${left} services` : ''}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {retailProducts.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-bold text-ink-500">Add retail products</div>
              <div className="flex flex-col gap-1.5">
                {retailProducts.map((item) => {
                  const qty = checkout.productSelections[item.id] || 0;
                  const stock = Math.floor(item.qty);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-ivory-400 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-ink-900">{item.name}</div>
                        <div className="text-[11.5px] text-ink-400">{cur}{item.retailPrice} · {stock > 0 ? `${stock} in stock` : 'Out of stock'}</div>
                      </div>
                      <div className="flex flex-none items-center gap-1.5">
                        <button onClick={() => setProductQty(item.id, qty - 1)} disabled={qty === 0} aria-label={`Remove one ${item.name}`} className="h-9 w-9 rounded-full border border-ivory-400 text-[16px] text-ink-500 disabled:opacity-40">−</button>
                        <span className="w-5 text-center text-[13px] font-semibold" aria-live="polite">{qty}</span>
                        <button onClick={() => setProductQty(item.id, qty + 1)} disabled={qty >= stock} aria-label={`Add one ${item.name}`} className="h-9 w-9 rounded-full border border-ivory-400 text-[16px] text-ink-500 disabled:opacity-40">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Tip ({cur})
            <input type="number" inputMode="decimal" min={0} value={checkout.tip || ''} onChange={(e) => updateTip(Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px] font-normal text-ink-900" placeholder="0" />
          </label>

          <div>
            <div className="mb-1.5 text-[12px] font-bold text-ink-500">Payment method</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Payment method">
              {(['Card', 'Cash'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={checkout.payMethod === m} onClick={() => setPayMethod(m)} className={`min-h-[44px] flex-1 rounded-[10px] border py-2.5 text-[13px] font-bold ${checkout.payMethod === m ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-[10px] bg-ivory-100 px-3.5 py-3 text-[13px]">
            {services.map((sv) => (
              <Line key={sv.id} label={sv.name} value={money(sv.price)} />
            ))}
            {services.length === 0 && <Line label="Services" value={money(appt.price)} />}
            {services.length > 0 && Math.abs(services.reduce((s, sv) => s + sv.price, 0) - appt.price) > 0.009 && <Line label="Booked price (prices changed since booking)" value={money(appt.price)} />}
            {appt.discount > 0 && <Line label="Discount" value={`−${money(appt.discount)}`} />}
            {paid > 0 && <Line label="Deposit / already paid" value={`−${money(Math.min(paid, servicesTotal + productsTotal))}`} />}
            <Line label="Balance due" value={money(balance)} strong />
            {Object.entries(checkout.productSelections).filter(([, q]) => q > 0).map(([itemId, q]) => {
              const item = state.inventory.find((i) => i.id === itemId);
              return item ? <Line key={itemId} label={`${item.name} × ${q}`} value={money(item.retailPrice * q)} /> : null;
            })}
            {checkout.tip > 0 && <Line label="Tip" value={money(checkout.tip)} />}
            <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1.5 text-[15px] font-bold text-ink-900"><span>Charge now</span><span>{money(chargeNow)}</span></div>
          </div>

          <button onClick={completeCheckout} className="min-h-[48px] w-full rounded-[10px] bg-plum-600 py-3.5 text-[14px] font-bold text-white hover:bg-plum-700">
            Complete &amp; Charge {money(chargeNow)}
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-ivory-300 pt-4">
        {appt.status === 'unconfirmed' && (
          <ActionBtn primary onClick={() => apptAction(appt.id, 'confirm')}>Confirm</ActionBtn>
        )}
        {appt.status === 'confirmed' && !isFuture && (
          <ActionBtn primary onClick={() => apptAction(appt.id, 'checkin')}>Check In</ActionBtn>
        )}
        {appt.status === 'checked-in' && (
          <ActionBtn primary onClick={() => apptAction(appt.id, 'start')}>Start Service</ActionBtn>
        )}
        {(appt.status === 'unconfirmed' || appt.status === 'confirmed') && (
          <>
            <ActionBtn onClick={() => openReschedule(appt.id)}>Reschedule</ActionBtn>
            <ActionBtn danger onClick={() => apptAction(appt.id, 'cancel')}>Cancel</ActionBtn>
            {!isFuture && <ActionBtn danger onClick={() => apptAction(appt.id, 'noshow')}>No-Show</ActionBtn>}
          </>
        )}
        {appt.status === 'completed' && owed > 0 && client && (
          <ActionBtn primary onClick={() => { close(); openRecordPayment(appt.clientId, appt.id); }}>Record {money(owed)} Payment</ActionBtn>
        )}
        {(appt.status === 'completed' || appt.status === 'cancelled' || appt.status === 'no-show') && client && !client.archived && (
          <ActionBtn onClick={() => { close(); rebookClient(appt.clientId, appt.id); }}>Rebook</ActionBtn>
        )}
        <div className="flex-1" />
        <button onClick={close} className="min-h-[40px] rounded-lg px-3.5 py-2 text-[13px] font-semibold text-ink-400">Close</button>
      </div>
    </Modal>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex-none">{value}</span>
    </div>
  );
}

function ActionBtn({ children, onClick, primary, danger }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  const cls = primary
    ? 'bg-plum-600 text-white font-bold hover:bg-plum-700'
    : danger
      ? 'border border-ivory-400 font-semibold text-ink-500 hover:border-bad-500 hover:text-bad-500'
      : 'border border-ivory-400 font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600';
  return (
    <button onClick={onClick} className={`min-h-[40px] rounded-lg px-3.5 py-2 text-[13px] ${cls}`}>
      {children}
    </button>
  );
}
