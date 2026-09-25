import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { timeOfDayGreeting } from '../lib/greeting';
import { formatDateLong, formatDuration, formatTime, todayISO } from '../lib/dates';
import { statusMeta } from '../lib/status';
import {
  apptBalance,
  apptTotal,
  clientName,
  getCollectedToday,
  getExpectedRevenueToday,
  getLowStockItems,
  getNeedsAttention,
  getNextAppointment,
  getOutstandingTotal,
  getRebookingOpportunities,
  getRecentActivity,
  getRevenueThisMonth,
  getTodaysSchedule,
  serviceNames,
  staffName,
} from '../lib/selectors';

export function Home() {
  const state = useStore((s) => s);
  const { business, clients, staff } = state;
  const openClient = useStore((s) => s.openClient);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const setSection = useStore((s) => s.setSection);
  const setMoneyTab = useStore((s) => s.setMoneyTab);
  const setGrowTab = useStore((s) => s.setGrowTab);
  const setBookingsView = useStore((s) => s.setBookingsView);
  const setBookingsDate = useStore((s) => s.setBookingsDate);
  const setPricingServiceId = useStore((s) => s.setPricingServiceId);
  const openNewClient = useStore((s) => s.openNewClient);
  const openNewAppt = useStore((s) => s.openNewAppt);
  const openRecordPayment = useStore((s) => s.openRecordPayment);
  const rebookClient = useStore((s) => s.rebookClient);
  const showCopyMessage = useStore((s) => s.showCopyMessage);
  const cur = business.currencySymbol;

  const owner = staff.find((s) => !s.archived)?.name.split(' ')[0];
  const ownerFirst = owner && owner !== 'You' ? owner : '';
  const greeting = `${timeOfDayGreeting()}${ownerFirst ? `, ${ownerFirst}` : ''}`;
  const isFresh = clients.length === 0;

  if (isFresh) {
    return (
      <div className="mx-auto max-w-[560px] animate-lum-fade">
        <h1 className="mb-1 font-serif text-[30px] font-medium text-ink-900">{greeting}</h1>
        <p className="mb-6 text-[14.5px] text-ink-500">{business.name} is set up. Here's what's ready, and what's next.</p>
        <div className="mb-5 rounded-2xl border border-ivory-400 bg-white p-6">
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-good-600"><Icon name="check" size={15} /> Business configured</div>
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-good-600"><Icon name="check" size={15} /> Services added ({state.services.filter((s) => s.active).length})</div>
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-good-600"><Icon name="check" size={15} /> Hours ready — {business.hours}</div>
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-ink-500"><Icon name="download" size={15} /> Saved on this device — export a backup from Settings → Data once you've added clients</div>
        </div>
        <div className="rounded-2xl bg-plum-600 p-6 text-white">
          <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide opacity-75">Next Step</div>
          <div className="mb-3.5 font-serif text-[22px] font-medium">Add your first client</div>
          <p className="mb-4 text-[13px] leading-relaxed opacity-90">Then book their appointment, check them in, and check out to record your first payment.</p>
          <button onClick={openNewClient} className="min-h-[44px] rounded-[9px] bg-white px-4 py-2.5 text-[13.5px] font-bold text-plum-600">Add First Client</button>
        </div>
      </div>
    );
  }

  const next = getNextAppointment(state);
  const attention = getNeedsAttention(state);
  const schedule = getTodaysSchedule(state);
  const activity = getRecentActivity(state, 6);
  const expectedToday = getExpectedRevenueToday(state);
  const collectedToday = getCollectedToday(state);
  const outstanding = getOutstandingTotal(state);
  const revenueMonth = getRevenueThisMonth(state);
  const lowStock = getLowStockItems(state);
  const rebook = getRebookingOpportunities(state);
  const today = todayISO();
  const activeToday = schedule.filter((a) => a.status !== 'no-show').length;

  const goAttention = (item: (typeof attention)[number]) => {
    if (item.onClick === 'client' && item.targetId) openClient(item.targetId);
    else if (item.onClick === 'grow-retention') { setSection('grow'); setGrowTab('Retention'); }
    else if (item.onClick === 'money-inventory') { setSection('money'); setMoneyTab('Inventory'); }
    else if (item.onClick === 'money-pricing') { setSection('money'); setMoneyTab('Pricing'); if (item.targetId) setPricingServiceId(item.targetId); }
    else if (item.onClick === 'bookings-unconfirmed') { setSection('bookings'); setBookingsView('Agenda'); }
    else if (item.onClick === 'bookings-date' && item.targetId) { setSection('bookings'); setBookingsDate(item.targetId); setBookingsView('Day'); }
    else if (item.onClick === 'grow-loyalty') { setSection('grow'); setGrowTab('Loyalty'); }
  };

  const nextIsToday = next?.date === today;

  return (
    <div className="mx-auto max-w-[1100px] animate-lum-fade">
      <h1 className="mb-1 font-serif text-[30px] font-medium text-ink-900">{greeting} 👋</h1>
      <p className="mb-4 text-[14.5px] text-ink-500">
        {activeToday} appointment{activeToday === 1 ? '' : 's'} today · {cur}{expectedToday.toFixed(0)} booked · {cur}{outstanding.toFixed(0)} outstanding
      </p>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <QuickAction icon="calendar" label="New Appointment" onClick={() => openNewAppt({ date: today })} primary />
        <QuickAction icon="user-plus" label="New Client" onClick={openNewClient} />
        <QuickAction icon="dollar-sign" label="Record Payment" onClick={() => openRecordPayment()} />
        <QuickAction icon="bookings" label="Today's Calendar" onClick={() => { setSection('bookings'); setBookingsDate(today); setBookingsView('Day'); }} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {next ? (
          <div className="relative overflow-hidden rounded-[18px] bg-plum-600 p-6 text-white sm:p-7">
            <div className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-wide opacity-75">Next Appointment · {nextIsToday ? 'Today' : formatDateLong(next.date)}</div>
            <div className="mb-1 font-serif text-[26px] font-medium">{clientName(state, next.clientId)}</div>
            <div className="mb-4 text-[14.5px] opacity-90">{serviceNames(state, next.serviceIds)} · {formatTime(next.time)} · {formatDuration(next.durationMin)} · {staffName(state, next.staffId)}</div>
            <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]">
              <div><div className="mb-0.5 opacity-70">Total</div><div className="text-[16px] font-bold">{cur}{apptTotal(next).toFixed(2)}</div></div>
              <div><div className="mb-0.5 opacity-70">Paid</div><div className="text-[16px] font-bold">{cur}{(apptTotal(next) - apptBalance(state, next)).toFixed(2)}</div></div>
              <div><div className="mb-0.5 opacity-70">Balance</div><div className="text-[16px] font-bold">{cur}{apptBalance(state, next).toFixed(2)}</div></div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => openClient(next.clientId)} className="min-h-[44px] rounded-[9px] bg-white/15 px-4 py-2.5 text-[13.5px] font-bold hover:bg-white/25">Open Client</button>
              <button onClick={() => openApptDetail(next.id)} className="min-h-[44px] rounded-[9px] bg-white px-4 py-2.5 text-[13.5px] font-bold text-plum-600 hover:bg-plum-50">
                {nextIsToday && next.status === 'confirmed' ? 'Check In / Checkout' : nextIsToday && (next.status === 'checked-in' || next.status === 'in-service') ? 'Checkout' : 'View Appointment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[18px] border border-ivory-400 bg-white p-8 text-center">
            <Icon name="calendar" size={26} className="mb-3 text-ink-300" />
            <div className="mb-1 text-[14.5px] font-bold text-ink-900">No upcoming appointments</div>
            <p className="mb-4 text-[13px] text-ink-400">Your schedule is clear.</p>
            <button onClick={() => openNewAppt()} className="min-h-[44px] rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">+ Book an Appointment</button>
          </div>
        )}

        <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
          <h2 className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Needs Attention</h2>
          {attention.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-400">All clear — nothing needs attention right now.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {attention.map((item) => (
                <button key={item.id} onClick={() => goAttention(item)} className="flex min-h-[40px] items-center gap-2.5 rounded-[9px] px-2 py-2 text-left text-[13.5px] text-ink-900 hover:bg-ivory-100">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1">{item.text}</span>
                  <Icon name="chevron-right" size={13} className="flex-none text-ink-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Collected today" value={`${cur}${collectedToday.toFixed(0)}`} sub={`${cur}${expectedToday.toFixed(0)} booked today`} onClick={() => { setSection('money'); setMoneyTab('Payments'); }} />
        <StatTile label="Revenue this month" value={`${cur}${revenueMonth.toFixed(0)}`} onClick={() => { setSection('money'); setMoneyTab('Overview'); }} />
        <StatTile label="Outstanding balances" value={`${cur}${outstanding.toFixed(0)}`} color={outstanding > 0 ? 'var(--color-bad-600)' : undefined} onClick={() => { setSection('money'); setMoneyTab('Payments'); }} />
        <StatTile label="Low stock items" value={String(lowStock.length)} color={lowStock.length > 0 ? 'var(--color-warn-500)' : undefined} onClick={() => { setSection('money'); setMoneyTab('Inventory'); }} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Today's Schedule</h2>
            <button onClick={() => { setSection('bookings'); setBookingsDate(today); setBookingsView('Day'); }} className="min-h-[36px] text-[12.5px] font-semibold text-plum-600">View calendar →</button>
          </div>
          {schedule.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-400">Nothing on the books today.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {schedule.map((a) => {
                const meta = statusMeta(a.status);
                return (
                  <button key={a.id} onClick={() => openApptDetail(a.id)} className="flex min-h-[44px] items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-ivory-100">
                    <span className="w-16 flex-none text-[12.5px] text-ink-500">{formatTime(a.time)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">
                      {clientName(state, a.clientId)} <span className="font-normal text-ink-400">· {serviceNames(state, a.serviceIds)}</span>
                    </span>
                    <span className="flex-none rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Due for Rebooking</h2>
            {rebook.length > 0 && <button onClick={() => { setSection('grow'); setGrowTab('Retention'); }} className="min-h-[36px] text-[12.5px] font-semibold text-plum-600">All {rebook.length} →</button>}
          </div>
          {rebook.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-400">Everyone's booked or not due yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rebook.slice(0, 4).map((e) => (
                <div key={e.client.id} className="flex items-center gap-2 rounded-[10px] px-1 py-1.5">
                  <button onClick={() => openClient(e.client.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13.5px] font-semibold text-ink-900">{e.client.name}</div>
                    <div className="text-[11.5px] text-ink-400">Last visit {e.daysSince} days ago</div>
                  </button>
                  <button
                    onClick={() => showCopyMessage('Rebooking Reminder', `Hi ${e.client.name.split(' ')[0]}! It's about time for your next visit at ${business.name} — want me to save you a spot this week?`)}
                    className="min-h-[36px] flex-none rounded-md border border-ivory-400 px-2.5 text-[11.5px] font-semibold text-ink-600 hover:border-plum-600 hover:text-plum-600"
                  >
                    Remind
                  </button>
                  <button onClick={() => rebookClient(e.client.id)} className="min-h-[36px] flex-none rounded-md bg-plum-600 px-2.5 text-[11.5px] font-bold text-white">Book</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
        <h2 className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-[13px] text-ink-400">No activity yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activity.map((act) => (
              <div key={act.id} className="border-l-2 border-ivory-400 pl-3.5 text-[13px] leading-relaxed text-ink-500">{act.text}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick, primary }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={`flex min-h-[44px] flex-none items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-bold ${primary ? 'bg-plum-600 text-white hover:bg-plum-700' : 'border border-ivory-400 bg-white text-ink-700 hover:border-plum-600 hover:text-plum-600'}`}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
}

function StatTile({ label, value, sub, color, onClick }: { label: string; value: string; sub?: string; color?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className="rounded-[14px] border border-ivory-400 bg-white px-4 py-4 text-left hover:border-plum-600">
      <div className="mb-1.5 text-[12px] text-ink-400">{label}</div>
      <div className="font-serif text-[22px] font-bold" style={{ color: color || 'var(--color-ink-900)' }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-ink-400">{sub}</div>}
    </Comp>
  );
}
