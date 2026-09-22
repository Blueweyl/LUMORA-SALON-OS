import { useStore } from '../../store/store';
import { Modal, ModalTitle } from '../ui/Modal';
import { Icon } from '../icons';
import { Pill } from '../ui/Badge';
import { apptBalance, apptTotal, getServices, servicesLeft } from '../../lib/selectors';
import { formatDateLong, formatDuration, formatTime } from '../../lib/dates';
import { statusMeta } from '../../lib/status';

export function ApptDetailModal() {
  const apptId = useStore((s) => s.apptDetailId);
  const state = useStore((s) => s);
  const close = useStore((s) => s.closeApptDetail);
  const apptAction = useStore((s) => s.apptAction);
  const openClient = useStore((s) => s.openClient);
  const updateTip = useStore((s) => s.updateCheckoutTip);
  const setPayMethod = useStore((s) => s.setCheckoutPayMethod);
  const setProductQty = useStore((s) => s.setCheckoutProductQty);
  const completeCheckout = useStore((s) => s.completeCheckout);
  const checkout = useStore((s) => s.checkoutDraft);

  const appt = state.appointments.find((a) => a.id === apptId);
  if (!appt) return null;

  const client = state.clients.find((c) => c.id === appt.clientId);
  const staff = state.staff.find((st) => st.id === appt.staffId);
  const services = getServices(state, appt.serviceIds);
  const meta = statusMeta(appt.status);
  const total = apptTotal(appt);
  const balance = apptBalance(appt);
  const inCheckoutFlow = ['confirmed', 'checked-in', 'in-service'].includes(appt.status);

  const usage: Record<string, number> = {};
  services.forEach((sv) => {
    state.inventory.forEach((item) => {
      const used = item.usagePerService[sv.id];
      if (used) usage[item.id] = (usage[item.id] || 0) + used;
    });
  });
  const usageList = Object.entries(usage).map(([itemId, amt]) => ({ item: state.inventory.find((i) => i.id === itemId)!, amt }));
  const retailProducts = state.inventory.filter((i) => i.retailPrice > 0);
  const productsTotal = Object.entries(checkout.productSelections).reduce((sum, [itemId, qty]) => {
    const item = state.inventory.find((i) => i.id === itemId);
    return sum + (item ? item.retailPrice * qty : 0);
  }, 0);
  const chargeNow = Math.max(0, balance) + productsTotal + checkout.tip;

  return (
    <Modal onClose={close} maxWidth={480}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <ModalTitle>{inCheckoutFlow && appt.status !== 'confirmed' ? 'Checkout' : 'Appointment'}</ModalTitle>
        </div>
        <Pill bg={meta.bg} color={meta.color}>{meta.label}</Pill>
      </div>

      <button onClick={() => { close(); openClient(appt.clientId); }} className="mb-4 flex items-center gap-3 rounded-xl border border-ivory-400 p-3 text-left hover:border-plum-600">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-plum-100 text-[13px] font-bold text-plum-600">
          {client?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold text-ink-900">{client?.name}</div>
          <div className="text-[12px] text-ink-400">{services.map((s) => s.name).join(' + ')}</div>
        </div>
        <Icon name="chevron-right" size={15} className="text-ink-400" />
      </button>

      <div className="mb-4 grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
          <div className="text-[11px] text-ink-400">When</div>
          <div className="font-semibold text-ink-900">{formatDateLong(appt.date)}, {formatTime(appt.time)}</div>
        </div>
        <div className="rounded-[10px] bg-ivory-100 px-3.5 py-2.5">
          <div className="text-[11px] text-ink-400">Staff · Duration</div>
          <div className="font-semibold text-ink-900">{staff?.name} · {formatDuration(appt.durationMin)}</div>
        </div>
      </div>

      {appt.notes && <div className="mb-4 rounded-[10px] border border-ivory-400 p-3 text-[13px] text-ink-500"><b className="text-ink-700">Notes:</b> {appt.notes}</div>}

      {!inCheckoutFlow ? (
        <div className="mb-2 flex justify-between rounded-[10px] bg-ivory-100 px-3.5 py-3 text-[13.5px]">
          <span className="text-ink-500">Total charged</span>
          <span className="font-bold text-ink-900">{state.business.currencySymbol}{total.toFixed(0)}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-ivory-300 pt-4">
          {usageList.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-bold text-ink-500">Inventory used this visit</div>
              <div className="flex flex-col gap-1">
                {usageList.map(({ item, amt }) => {
                  const remaining = item.qty - amt;
                  const left = servicesLeft({ ...item, qty: remaining });
                  return (
                    <div key={item.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-ink-700">{item.name} <span className="text-ink-400">−{amt}{item.unit}</span></span>
                      <span className="text-ink-400">{remaining}{item.unit} left{left !== null ? ` · ~${left} services` : ''}</span>
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
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-ivory-400 px-3 py-2">
                      <div>
                        <div className="text-[13px] font-semibold text-ink-900">{item.name}</div>
                        <div className="text-[11.5px] text-ink-400">{state.business.currencySymbol}{item.retailPrice}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setProductQty(item.id, qty - 1)} className="h-6 w-6 rounded-full border border-ivory-400 text-ink-500">−</button>
                        <span className="w-4 text-center text-[13px] font-semibold">{qty}</span>
                        <button onClick={() => setProductQty(item.id, qty + 1)} className="h-6 w-6 rounded-full border border-ivory-400 text-ink-500">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
            Tip ({state.business.currencySymbol})
            <input type="number" min={0} value={checkout.tip || ''} onChange={(e) => updateTip(Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[14px]" placeholder="0" />
          </label>

          <div>
            <div className="mb-1.5 text-[12px] font-bold text-ink-500">Payment method</div>
            <div className="flex gap-2">
              {(['Card', 'Cash'] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)} className={`flex-1 rounded-[10px] border py-2.5 text-[13px] font-bold ${checkout.payMethod === m ? 'border-plum-600 bg-plum-50 text-plum-600' : 'border-ivory-400 text-ink-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-[10px] bg-ivory-100 px-3.5 py-3 text-[13px]">
            <div className="flex justify-between text-ink-500"><span>Balance due</span><span>{state.business.currencySymbol}{balance.toFixed(0)}</span></div>
            {productsTotal > 0 && <div className="flex justify-between text-ink-500"><span>Products</span><span>{state.business.currencySymbol}{productsTotal.toFixed(0)}</span></div>}
            {checkout.tip > 0 && <div className="flex justify-between text-ink-500"><span>Tip</span><span>{state.business.currencySymbol}{checkout.tip.toFixed(0)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1.5 text-[15px] font-bold text-ink-900"><span>Total charge</span><span>{state.business.currencySymbol}{chargeNow.toFixed(0)}</span></div>
          </div>

          <button onClick={completeCheckout} className="w-full rounded-[10px] bg-plum-600 py-3.5 text-[14px] font-bold text-white hover:bg-plum-700">
            Complete &amp; Charge {state.business.currencySymbol}{chargeNow.toFixed(0)}
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-ivory-300 pt-4">
        {appt.status === 'unconfirmed' && (
          <button onClick={() => apptAction(appt.id, 'confirm')} className="rounded-lg bg-plum-600 px-3.5 py-2 text-[13px] font-bold text-white">Confirm</button>
        )}
        {appt.status === 'confirmed' && (
          <button onClick={() => apptAction(appt.id, 'checkin')} className="rounded-lg bg-plum-600 px-3.5 py-2 text-[13px] font-bold text-white">Check In</button>
        )}
        {appt.status === 'checked-in' && (
          <button onClick={() => apptAction(appt.id, 'start')} className="rounded-lg bg-plum-600 px-3.5 py-2 text-[13px] font-bold text-white">Start Service</button>
        )}
        {(appt.status === 'unconfirmed' || appt.status === 'confirmed') && (
          <>
            <button onClick={() => apptAction(appt.id, 'cancel')} className="rounded-lg border border-ivory-400 px-3.5 py-2 text-[13px] font-semibold text-ink-500 hover:border-bad-500 hover:text-bad-500">Cancel</button>
            <button onClick={() => apptAction(appt.id, 'noshow')} className="rounded-lg border border-ivory-400 px-3.5 py-2 text-[13px] font-semibold text-ink-500 hover:border-bad-500 hover:text-bad-500">No-Show</button>
          </>
        )}
        <div className="flex-1" />
        <button onClick={close} className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-ink-400">Close</button>
      </div>
    </Modal>
  );
}
