import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { timeOfDayGreeting } from '../lib/greeting';
import { formatDuration, formatTime } from '../lib/dates';
import { statusMeta } from '../lib/status';
import {
  getExpectedRevenueToday,
  getLowStockItems,
  getNeedsAttention,
  getNextAppointment,
  getOutstandingTotal,
  getRecentActivity,
  getRevenueThisMonth,
  getTodaysSchedule,
  serviceNames,
  apptTotal,
} from '../lib/selectors';

export function Home() {
  const state = useStore((s) => s);
  const { business, clients, staff } = state;
  const openClient = useStore((s) => s.openClient);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const apptAction = useStore((s) => s.apptAction);
  const setSection = useStore((s) => s.setSection);
  const setMoneyTab = useStore((s) => s.setMoneyTab);
  const setGrowTab = useStore((s) => s.setGrowTab);
  const openNewClient = useStore((s) => s.openNewClient);

  const ownerFirst = staff[0]?.name.split(' ')[0] || 'there';
  const isFresh = clients.length === 0;

  if (isFresh) {
    return (
      <div className="mx-auto max-w-[560px] animate-lum-fade">
        <h1 className="mb-1 font-serif text-[30px] font-medium text-ink-900">{timeOfDayGreeting()}, {ownerFirst}</h1>
        <p className="mb-6 text-[14.5px] text-ink-500">Your business is set up. Here's what's ready, and what's next.</p>
        <div className="mb-5 rounded-2xl border border-ivory-400 bg-white p-6">
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-good-600"><Icon name="check" size={15} /> Business configured</div>
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-good-600"><Icon name="check" size={15} /> Services added ({state.services.length})</div>
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] font-semibold text-good-600"><Icon name="check" size={15} /> Hours ready — {business.hours}</div>
        </div>
        <div className="rounded-2xl bg-plum-600 p-6 text-white">
          <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide opacity-75">Next Step</div>
          <div className="mb-3.5 font-serif text-[22px] font-medium">Add your first client</div>
          <p className="mb-4 text-[13px] leading-relaxed opacity-90">Then book their appointment, check them in, and check out to record your first payment.</p>
          <button onClick={openNewClient} className="rounded-[9px] bg-white px-4 py-2.5 text-[13.5px] font-bold text-plum-600">Add First Client</button>
        </div>
      </div>
    );
  }

  const next = getNextAppointment(state);
  const attention = getNeedsAttention(state);
  const schedule = getTodaysSchedule(state);
  const activity = getRecentActivity(state, 6);
  const expectedToday = getExpectedRevenueToday(state);
  const outstanding = getOutstandingTotal(state);
  const revenueMonth = getRevenueThisMonth(state);
  const lowStock = getLowStockItems(state);

  const goAttention = (item: (typeof attention)[number]) => {
    if (item.onClick === 'client' && item.targetId) openClient(item.targetId);
    else if (item.onClick === 'grow-retention') { setSection('grow'); setGrowTab('Retention'); }
    else if (item.onClick === 'money-inventory') { setSection('money'); setMoneyTab('Inventory'); }
    else if (item.onClick === 'bookings-unconfirmed') setSection('bookings');
    else if (item.onClick === 'grow-loyalty') { setSection('grow'); setGrowTab('Loyalty'); }
  };

  return (
    <div className="mx-auto max-w-[1100px] animate-lum-fade">
      <h1 className="mb-1 font-serif text-[30px] font-medium text-ink-900">{timeOfDayGreeting()}, {ownerFirst} 👋</h1>
      <p className="mb-6 text-[14.5px] text-ink-500">
        {schedule.length} appointment{schedule.length === 1 ? '' : 's'} today · {business.currencySymbol}{expectedToday.toFixed(0)} expected · {business.currencySymbol}{outstanding.toFixed(0)} outstanding
      </p>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {next ? (
          <div className="relative overflow-hidden rounded-[18px] bg-plum-600 p-7 text-white">
            <div className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-wide opacity-75">Next Appointment</div>
            <div className="mb-1 font-serif text-[26px] font-medium">{clients.find((c) => c.id === next.clientId)?.name}</div>
            <div className="mb-4 text-[14.5px] opacity-90">{serviceNames(state, next.serviceIds)} · {formatTime(next.time)} · {formatDuration(next.durationMin)}</div>
            <div className="mb-5 flex gap-6 text-[13.5px]">
              <div><div className="mb-0.5 opacity-70">Total</div><div className="text-[16px] font-bold">{business.currencySymbol}{apptTotal(next).toFixed(0)}</div></div>
              <div><div className="mb-0.5 opacity-70">Deposit</div><div className="text-[16px] font-bold">{business.currencySymbol}{next.deposit.toFixed(0)}</div></div>
              <div><div className="mb-0.5 opacity-70">Balance</div><div className="text-[16px] font-bold">{business.currencySymbol}{(apptTotal(next) - next.deposit).toFixed(0)}</div></div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => openClient(next.clientId)} className="rounded-[9px] bg-white/15 px-4 py-2.5 text-[13.5px] font-bold hover:bg-white/25">Open Client</button>
              <button
                onClick={() => (next.status === 'confirmed' ? apptAction(next.id, 'checkin') : openApptDetail(next.id))}
                className="rounded-[9px] bg-white px-4 py-2.5 text-[13.5px] font-bold text-plum-600 hover:bg-plum-50"
              >
                {next.status === 'confirmed' ? 'Start Appointment' : 'View Appointment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[18px] border border-ivory-400 bg-white p-8 text-center">
            <Icon name="calendar" size={26} className="mb-3 text-ink-300" />
            <div className="mb-1 text-[14.5px] font-bold text-ink-900">No upcoming appointments</div>
            <p className="text-[13px] text-ink-400">Your schedule is clear. Book one from Bookings.</p>
          </div>
        )}

        <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
          <div className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Needs Attention</div>
          {attention.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-400">All clear — nothing needs attention right now.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {attention.map((item) => (
                <button key={item.id} onClick={() => goAttention(item)} className="flex items-center gap-2.5 rounded-[9px] px-2 py-2 text-left text-[13.5px] text-ink-900 hover:bg-ivory-100">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: item.color }} />
                  {item.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Revenue today" value={`${business.currencySymbol}${expectedToday.toFixed(0)}`} />
        <StatTile label="Revenue this month" value={`${business.currencySymbol}${revenueMonth.toFixed(0)}`} />
        <StatTile label="Outstanding" value={`${business.currencySymbol}${outstanding.toFixed(0)}`} color="var(--color-bad-600)" />
        <StatTile label="Low stock items" value={String(lowStock.length)} color="var(--color-warn-500)" onClick={() => { setSection('money'); setMoneyTab('Inventory'); }} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Today's Schedule</div>
            <button onClick={() => setSection('bookings')} className="text-[12.5px] font-semibold text-plum-600">View calendar →</button>
          </div>
          {schedule.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-400">Nothing on the books today.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {schedule.map((a) => {
                const c = clients.find((cl) => cl.id === a.clientId);
                const meta = statusMeta(a.status);
                return (
                  <button key={a.id} onClick={() => openApptDetail(a.id)} className="flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-ivory-100">
                    <span className="w-16 flex-none text-[12.5px] text-ink-500">{formatTime(a.time)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">
                      {c?.name} <span className="font-normal text-ink-400">· {serviceNames(state, a.serviceIds)}</span>
                    </span>
                    <span className="flex-none rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-ivory-400 bg-white p-6">
          <div className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Recent Activity</div>
          {activity.length === 0 ? (
            <p className="text-[13px] text-ink-400">No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activity.map((act) => (
                <div key={act.id} className="border-l-2 border-ivory-400 pl-3.5 text-[13px] leading-relaxed text-ink-500">{act.text}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, color, onClick }: { label: string; value: string; color?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className="rounded-[14px] border border-ivory-400 bg-white px-4 py-4 text-left">
      <div className="mb-1.5 text-[12px] text-ink-400">{label}</div>
      <div className="font-serif text-[22px] font-bold" style={{ color: color || 'var(--color-ink-900)' }}>{value}</div>
    </Comp>
  );
}
