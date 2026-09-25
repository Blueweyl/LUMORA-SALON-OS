import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { getWeekDays, getMonthCells } from '../lib/calendar';
import { formatDateLong, formatDateShort, formatDateWeekday, formatTime, todayISO, MONTHS } from '../lib/dates';
import { statusMeta } from '../lib/status';
import { activeStaff, apptTotal, clientName, getAppointmentsForDate, serviceNames, staffName } from '../lib/selectors';
import { isOpenDay } from '../lib/hours';
import type { BookingsView } from '../store/types';

const VIEWS: BookingsView[] = ['Day', 'Week', 'Month', 'Agenda'];

export function Bookings() {
  const state = useStore((s) => s);
  const { staff, staffFilter, bookingsView, bookingsDate } = state;
  const setStaffFilter = useStore((s) => s.setStaffFilter);
  const setView = useStore((s) => s.setBookingsView);
  const shiftDate = useStore((s) => s.shiftBookingsDate);
  const goToday = useStore((s) => s.goToday);
  const openNewAppt = useStore((s) => s.openNewAppt);

  const headerLabel = () => {
    if (bookingsView === 'Day') return formatDateLong(bookingsDate);
    if (bookingsView === 'Month') {
      const d = new Date(bookingsDate + 'T00:00:00');
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (bookingsView === 'Week') {
      const days = getWeekDays(bookingsDate);
      return `${formatDateShort(days[0].date)} – ${formatDateShort(days[6].date)}`;
    }
    return 'Upcoming';
  };

  return (
    <div className="mx-auto max-w-[1200px] animate-lum-fade">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 font-serif text-[28px] font-medium text-ink-900">Bookings</h1>
          <div className="flex items-center gap-2 text-[14px] text-ink-500">
            {bookingsView !== 'Agenda' && (
              <>
                <button onClick={() => shiftDate(-1)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-ivory-200"><Icon name="chevron-left" size={15} /></button>
                <span>{headerLabel()}</span>
                <button onClick={() => shiftDate(1)} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-ivory-200"><Icon name="chevron-right" size={15} /></button>
                {bookingsDate !== todayISO() && <button onClick={goToday} className="ml-1 min-h-[36px] text-[12px] font-bold text-plum-600">Today</button>}
                <input type="date" aria-label="Jump to date" value={bookingsDate} onChange={(e) => e.target.value && useStore.getState().setBookingsDate(e.target.value)} className="ml-1 w-9 cursor-pointer rounded-md border border-ivory-400 bg-white p-1 text-[0px] sm:w-auto sm:text-[12px]" />
              </>
            )}
            {bookingsView === 'Agenda' && <span>{headerLabel()}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select aria-label="Filter by staff" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="min-h-[44px] rounded-[9px] border border-ivory-400 bg-white px-3 py-2.5 text-[13px] font-semibold text-ink-900">
            <option value="all">All staff</option>
            {activeStaff({ staff }).map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-[9px] border border-ivory-400 bg-white">
            {VIEWS.map((v) => (
              <button key={v} aria-pressed={bookingsView === v} onClick={() => setView(v)} className={`min-h-[44px] px-3 py-2.5 sm:px-3.5 text-[13px] font-semibold ${bookingsView === v ? 'bg-plum-600 text-white' : 'text-ink-700'}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => openNewAppt()} className="min-h-[44px] rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-plum-700">+ New Appointment</button>
        </div>
      </div>

      {bookingsView === 'Day' && <DayView />}
      {bookingsView === 'Week' && <WeekView />}
      {bookingsView === 'Month' && <MonthView />}
      {bookingsView === 'Agenda' && <AgendaView />}

      <Waitlist />
    </div>
  );
}

function AppointmentRow({ id, time, clientName, serviceLabel, staffName, durationLabel, price, currency, statusLabel, statusBg, statusColor, onClick, dateLabel }: {
  id: string; time?: string; clientName: string; serviceLabel: string; staffName: string; durationLabel: string; price: number; currency: string; statusLabel: string; statusBg: string; statusColor: string; onClick: () => void; dateLabel?: string;
}) {
  return (
    <button key={id} onClick={onClick} className="flex w-full items-center gap-3.5 border-b border-ivory-200 px-3.5 py-3 text-left last:border-0 hover:bg-ivory-100 sm:gap-4">
      {dateLabel ? (
        <span className="w-16 flex-none text-[12px] text-ink-400">{dateLabel}</span>
      ) : (
        <span className="w-14 flex-none text-[13px] font-semibold text-ink-500">{time}</span>
      )}
      <span className="h-8 w-[3px] flex-none rounded-full" style={{ background: statusColor }} />
      <span className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-ink-900">{clientName}</div>
        <div className="truncate text-[12px] text-ink-400">{serviceLabel} · {staffName} · {durationLabel}</div>
      </span>
      <span className="hidden flex-none text-[13.5px] font-bold text-ink-900 sm:block">{currency}{price.toFixed(0)}</span>
      <span className="flex-none rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: statusBg, color: statusColor }}>{statusLabel}</span>
    </button>
  );
}

function DayView() {
  const state = useStore((s) => s);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const openNewAppt = useStore((s) => s.openNewAppt);
  const { bookingsDate, staffFilter } = state;
  const list = getAppointmentsForDate(state, bookingsDate).filter((a) => staffFilter === 'all' || a.staffId === staffFilter);
  const isToday = bookingsDate === todayISO();
  const isPast = bookingsDate < todayISO();
  const closed = !isOpenDay(state.business, bookingsDate);

  return (
    <div className="mb-6 rounded-2xl border border-ivory-400 bg-white p-1.5">
      {closed && list.length > 0 && <div className="px-3.5 py-2 text-[12px] font-semibold text-warn-600">You're normally closed on this day.</div>}
      {list.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mb-1.5 text-[14px] font-bold text-ink-900">
            {closed ? 'Closed — ' : ''}No appointments{staffFilter !== 'all' ? ` for ${staffName(state, staffFilter)}` : ''} {isToday ? 'today' : `on ${formatDateLong(bookingsDate)}`}
          </div>
          {!isPast && (
            <>
              <p className="mb-4 text-[13px] text-ink-400">{staffFilter !== 'all' ? "Book one now, or clear the staff filter to see everyone's day." : 'Book one now.'}</p>
              <button onClick={() => openNewAppt({ date: bookingsDate })} className="min-h-[44px] rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">+ New Appointment</button>
            </>
          )}
        </div>
      ) : (
        list.map((a) => {
          const meta = statusMeta(a.status);
          return (
            <AppointmentRow
              key={a.id}
              id={a.id}
              time={formatTime(a.time)}
              clientName={clientName(state, a.clientId)}
              serviceLabel={serviceNames(state, a.serviceIds)}
              staffName={staffName(state, a.staffId)}
              durationLabel={`${a.durationMin}m`}
              price={apptTotal(a)}
              currency={state.business.currencySymbol}
              statusLabel={meta.label}
              statusBg={meta.bg}
              statusColor={meta.color}
              onClick={() => openApptDetail(a.id)}
            />
          );
        })
      )}
    </div>
  );
}

function WeekView() {
  const state = useStore((s) => s);
  const setDate = useStore((s) => s.setBookingsDate);
  const setView = useStore((s) => s.setBookingsView);
  const days = getWeekDays(state.bookingsDate);

  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const count = getAppointmentsForDate(state, d.date).filter((a) => state.staffFilter === 'all' || a.staffId === state.staffFilter).length;
        return (
          <button
            key={d.date}
            onClick={() => { setDate(d.date); setView('Day'); }}
            aria-label={`${d.label} ${d.dayNum}: ${count} appointments`}
            className={`min-h-[88px] rounded-[14px] sm:min-h-[112px] border bg-white p-3.5 text-left ${d.isToday ? 'border-plum-600' : 'border-ivory-400'}`}
          >
            <div className="mb-1.5 text-[11.5px] font-bold" style={{ color: d.isToday ? 'var(--color-plum-600)' : 'var(--color-ink-400)' }}>{d.label} {d.dayNum}</div>
            {count > 0 ? (
              <div className="text-[12px] font-semibold text-ink-700">{count} appt{count === 1 ? '' : 's'}</div>
            ) : (
              <div className="text-[12px] text-ink-300">{isOpenDay(state.business, d.date) ? 'Free day' : 'Closed'}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MonthView() {
  const state = useStore((s) => s);
  const setDate = useStore((s) => s.setBookingsDate);
  const setView = useStore((s) => s.setBookingsView);
  const cells = getMonthCells(state.bookingsDate);

  return (
    <div className="mb-6 grid grid-cols-7 gap-1 sm:gap-1.5">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} className="pb-1 text-center text-[10.5px] font-bold uppercase text-ink-400">{d}</div>
      ))}
      {cells.map((c) => {
        const count = getAppointmentsForDate(state, c.date).filter((a) => state.staffFilter === 'all' || a.staffId === state.staffFilter).length;
        return (
          <button
            key={c.date}
            onClick={() => { setDate(c.date); setView('Day'); }}
            aria-label={`${c.date}: ${count} appointments`}
            className="min-h-[48px] rounded-[10px] border p-1.5 text-left text-[12px] sm:min-h-[64px]"
            style={{ background: c.isToday ? 'var(--color-plum-50)' : '#fff', borderColor: 'var(--color-ivory-400)', opacity: c.inMonth ? 1 : 0.4 }}
          >
            <div className="font-bold" style={{ color: c.isToday ? 'var(--color-plum-600)' : 'var(--color-ink-700)' }}>{c.day}</div>
            {count > 0 && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-plum-600" />}
          </button>
        );
      })}
    </div>
  );
}

function AgendaView() {
  const state = useStore((s) => s);
  const openApptDetail = useStore((s) => s.openApptDetail);
  const today = todayISO();
  const list = state.appointments
    .filter((a) => a.date >= today && ['unconfirmed', 'confirmed', 'checked-in', 'in-service'].includes(a.status) && (state.staffFilter === 'all' || a.staffId === state.staffFilter))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 60);

  return (
    <div className="mb-6 rounded-2xl border border-ivory-400 bg-white p-1.5">
      {list.length === 0 ? (
        <div className="px-5 py-12 text-center text-[13px] text-ink-400">No upcoming appointments.</div>
      ) : (
        list.map((a) => {
          const meta = statusMeta(a.status);
          return (
            <AppointmentRow
              key={a.id}
              id={a.id}
              dateLabel={`${formatDateWeekday(a.date)}, ${formatTime(a.time)}`}
              clientName={clientName(state, a.clientId)}
              serviceLabel={serviceNames(state, a.serviceIds)}
              staffName={staffName(state, a.staffId)}
              durationLabel={`${a.durationMin}m`}
              price={apptTotal(a)}
              currency={state.business.currencySymbol}
              statusLabel={meta.label}
              statusBg={meta.bg}
              statusColor={meta.color}
              onClick={() => openApptDetail(a.id)}
            />
          );
        })
      )}
    </div>
  );
}

function Waitlist() {
  const state = useStore((s) => s);
  const copyWaitlistMessage = useStore((s) => s.copyWaitlistMessage);
  const removeFromWaitlist = useStore((s) => s.removeFromWaitlist);

  if (state.waitlist.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ivory-400 bg-white p-5">
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Waitlist</div>
      <div className="flex flex-col gap-1">
        {state.waitlist.map((w) => {
          return (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ivory-200 py-2.5 last:border-0">
              <span className="min-w-0 text-[13.5px]"><b className="text-ink-900">{clientName(state, w.clientId)}</b> <span className="text-ink-400">· {serviceNames(state, w.serviceIds)}{w.note ? ` · ${w.note}` : ''}</span></span>
              <div className="flex gap-1.5">
                <button onClick={() => useStore.getState().openNewAppt({ clientId: w.clientId, serviceIds: w.serviceIds })} className="min-h-[36px] rounded-md bg-plum-600 px-2.5 py-1.5 text-[12px] font-bold text-white">Book</button>
                <button onClick={() => copyWaitlistMessage(w.id)} className="min-h-[36px] rounded-md border border-ivory-400 px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:border-plum-600 hover:text-plum-600">Copy Message</button>
                <button onClick={() => removeFromWaitlist(w.id)} className="min-h-[36px] rounded-md border border-ivory-400 px-2.5 py-1.5 text-[12px] font-semibold text-ink-400 hover:border-bad-500 hover:text-bad-500">Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
