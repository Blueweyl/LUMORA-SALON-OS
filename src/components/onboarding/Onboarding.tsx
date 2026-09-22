import { useStore } from '../../store/store';
import { CURRENCIES } from '../../data/seed';
import { Icon } from '../icons';

const STEP_LABELS = ['Business', 'Services', 'Team', 'Hours', 'Booking Preferences'];

export function Onboarding() {
  const step = useStore((s) => s.onboardingStep);
  const dismiss = useStore((s) => s.dismissOnboarding);
  const startSetup = useStore((s) => s.startSetup);

  if (step === 0) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-ivory-100 p-6">
        <div className="w-full max-w-[480px] animate-lum-fade text-center">
          <div className="font-serif-italic mb-4 text-[15px] tracking-[0.06em] text-plum-600">LUMORA</div>
          <h1 className="mb-2.5 font-serif text-[40px] font-medium leading-[1.15] text-ink-900">Welcome to Lumora</h1>
          <p className="mx-auto mb-9 max-w-[400px] text-[16px] leading-relaxed text-ink-500">
            Your beauty business command center. Book, serve, get paid, rebook and grow — all in one place.
          </p>
          <div className="mx-auto flex max-w-[320px] flex-col gap-3">
            <button onClick={dismiss} className="rounded-xl bg-plum-600 py-4 text-[15px] font-bold text-white hover:bg-plum-700">
              Explore Demo Business
            </button>
            <button onClick={startSetup} className="rounded-xl border-[1.5px] border-ivory-400 py-4 text-[15px] font-semibold text-ink-900 hover:border-plum-600">
              Set Up My Business
            </button>
          </div>
          <p className="mt-5 text-[12.5px] text-ink-400">Loads with realistic demo data — reset anytime from Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-ivory-100 p-6">
      <div className="w-full max-w-[480px] animate-lum-fade">
        <Progress step={step} />
        {step === 1 && <StepBusiness />}
        {step === 2 && <StepServices />}
        {step === 3 && <StepTeam />}
        {step === 4 && <StepHours />}
        {step === 5 && <StepBooking />}
        {step === 6 && <StepReady />}
        {step >= 1 && step <= 5 && <Nav />}
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const pct = Math.min(100, (step / 6) * 100);
  return (
    <div className="mb-7 h-1 overflow-hidden rounded-full bg-ivory-300">
      <div className="h-full bg-plum-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <>
      <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Step {n} of 5 · {STEP_LABELS[n - 1]}</div>
      <h2 className="mb-4 font-serif text-[26px] font-medium text-ink-900">{title}</h2>
    </>
  );
}

function StepBusiness() {
  const biz = useStore((s) => s.onboardingBiz);
  const update = useStore((s) => s.updateObBiz);
  const setTeamType = useStore((s) => s.setObTeamType);
  return (
    <div>
      <StepHeader n={1} title="Tell us about your business" />
      <label className="mb-4 flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Business name
        <input value={biz.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Mia's Studio" className="rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[15px]" />
      </label>
      <label className="mb-4 flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Currency
        <select value={biz.currencyCode} onChange={(e) => update('currencyCode', e.target.value)} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[14px]">
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </label>
      <div className="mb-2.5 text-[12.5px] font-bold text-ink-500">Are you solo or a team?</div>
      <div className="flex gap-2.5">
        <button onClick={() => setTeamType('solo')} className={`flex-1 rounded-[10px] border-[1.5px] bg-white py-3.5 text-[13.5px] font-bold ${biz.teamType === 'solo' ? 'border-plum-600 text-plum-600' : 'border-ivory-400 text-ink-700'}`}>Just me</button>
        <button onClick={() => setTeamType('team')} className={`flex-1 rounded-[10px] border-[1.5px] bg-white py-3.5 text-[13.5px] font-bold ${biz.teamType === 'team' ? 'border-plum-600 text-plum-600' : 'border-ivory-400 text-ink-700'}`}>A team</button>
      </div>
    </div>
  );
}

function StepServices() {
  const biz = useStore((s) => s.onboardingBiz);
  const currency = CURRENCIES.find((c) => c.code === biz.currencyCode)?.symbol || '$';
  const setMode = useStore((s) => s.setObServiceMode);
  const addRow = useStore((s) => s.addObService);
  const removeRow = useStore((s) => s.removeObService);
  const updateField = useStore((s) => s.updateObServiceField);
  const toggleAdv = useStore((s) => s.toggleObServiceAdvanced);

  return (
    <div>
      <StepHeader n={2} title="What do you offer?" />
      <p className="mb-4 text-[13.5px] text-ink-500">You're fully in control of your services and pricing — start from a suggested list or build your own from scratch.</p>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setMode('suggested')} className={`flex-1 rounded-[9px] border-[1.5px] border-plum-600 py-2.5 text-[12.5px] font-bold ${biz.serviceMode === 'suggested' ? 'bg-plum-600 text-white' : 'bg-white text-plum-600'}`}>
          Use Suggested Services
        </button>
        <button onClick={() => setMode('scratch')} className={`flex-1 rounded-[9px] border-[1.5px] border-plum-600 py-2.5 text-[12.5px] font-bold ${biz.serviceMode === 'scratch' ? 'bg-plum-600 text-white' : 'bg-white text-plum-600'}`}>
          Start From Scratch
        </button>
      </div>
      <div className="flex max-h-[320px] flex-col gap-2.5 overflow-y-auto pr-1">
        {biz.serviceDraft.map((sv) => (
          <div key={sv.id} className="rounded-xl border border-ivory-400 p-3">
            <div className="mb-2 flex gap-2">
              <input value={sv.name} onChange={(e) => updateField(sv.id, 'name', e.target.value)} placeholder="Service name" className="flex-[2] rounded-lg border border-ivory-400 px-2.5 py-2 text-[13.5px] font-semibold" />
              <input value={sv.category} onChange={(e) => updateField(sv.id, 'category', e.target.value)} placeholder="Category" className="flex-1 rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px]" />
              <button onClick={() => removeRow(sv.id)} className="flex-none rounded-lg border border-ivory-400 px-2.5 text-[12px] text-bad-500">Remove</button>
            </div>
            <div className="mb-2 flex gap-2">
              <label className="flex-1 text-[11px] text-ink-400">Duration (min)
                <input type="number" value={sv.duration} onChange={(e) => updateField(sv.id, 'duration', Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px]" />
              </label>
              <label className="flex-1 text-[11px] text-ink-400">Price ({currency})
                <input type="number" value={sv.price} onChange={(e) => updateField(sv.id, 'price', Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px]" />
              </label>
            </div>
            <button onClick={() => toggleAdv(sv.id)} className="text-[11.5px] font-bold text-plum-600">{sv.advanced ? 'Hide cost details' : 'Add cost details (optional)'}</button>
            {sv.advanced && (
              <div className="mt-2 flex gap-2">
                <label className="flex-1 text-[11px] text-ink-400">Materials ({currency})
                  <input type="number" value={sv.materials} onChange={(e) => updateField(sv.id, 'materials', Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px]" />
                </label>
                <label className="flex-1 text-[11px] text-ink-400">Labor hours
                  <input type="number" step={0.1} value={sv.laborHours} onChange={(e) => updateField(sv.id, 'laborHours', Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px]" />
                </label>
                <label className="flex-1 text-[11px] text-ink-400">Overhead ({currency})
                  <input type="number" value={sv.overhead} onChange={(e) => updateField(sv.id, 'overhead', Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-ivory-400 px-2.5 py-2 text-[13px]" />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={addRow} className="mt-3 w-full rounded-[10px] border-[1.5px] border-dashed border-ivory-500 py-3 text-[13px] font-bold text-plum-600">+ Add Custom Service</button>
    </div>
  );
}

function StepTeam() {
  const biz = useStore((s) => s.onboardingBiz);
  const update = useStore((s) => s.updateObStaffName);
  const add = useStore((s) => s.addObStaffField);
  return (
    <div>
      <StepHeader n={3} title="Add your team" />
      <div className="flex flex-col gap-2.5">
        {biz.staffNames.map((name, i) => (
          <input key={i} value={name} onChange={(e) => update(i, e.target.value)} placeholder="Staff name" className="rounded-[10px] border border-ivory-400 px-3.5 py-3 text-[14px]" />
        ))}
      </div>
      <button onClick={add} className="mt-2.5 text-[12.5px] font-bold text-plum-600">+ Add another</button>
    </div>
  );
}

function StepHours() {
  const biz = useStore((s) => s.onboardingBiz);
  const update = useStore((s) => s.updateObBiz);
  return (
    <div>
      <StepHeader n={4} title="When are you open?" />
      <input value={biz.hours} onChange={(e) => update('hours', e.target.value)} className="w-full rounded-[10px] border border-ivory-400 px-3.5 py-3 text-[14px]" />
      <p className="mt-2.5 text-[12.5px] text-ink-400">You can set exact hours per day later in Settings.</p>
    </div>
  );
}

function StepBooking() {
  const biz = useStore((s) => s.onboardingBiz);
  const update = useStore((s) => s.updateObBiz);
  return (
    <div>
      <StepHeader n={5} title="Booking defaults" />
      <label className="mb-4 flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Default deposit ({biz.depositPct}%)
        <input type="range" min={0} max={50} value={biz.depositPct} onChange={(e) => update('depositPct', Number(e.target.value))} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink-500">
        Buffer between appointments (minutes)
        <input type="number" value={biz.bufferMin} onChange={(e) => update('bufferMin', Number(e.target.value))} className="rounded-[10px] border border-ivory-400 px-3.5 py-3 text-[14px]" />
      </label>
    </div>
  );
}

function StepReady() {
  const finishAndAddAppt = useStore((s) => s.finishAndAddAppt);
  const finishSetup = useStore((s) => s.finishSetup);
  return (
    <div className="text-center">
      <div className="mb-2.5 font-serif text-[30px] font-medium text-ink-900">You're ready! 🎉</div>
      <p className="mb-7 text-[14.5px] text-ink-500">Your business is set up. Demo clients and appointments are loaded so you can see it in action right away.</p>
      <div className="mx-auto flex max-w-[280px] flex-col gap-2.5">
        <button onClick={finishAndAddAppt} className="flex items-center justify-center gap-1.5 rounded-xl bg-plum-600 py-3.5 text-[14.5px] font-bold text-white">
          Add First Appointment <Icon name="arrow-right" size={15} />
        </button>
        <button onClick={finishSetup} className="rounded-xl border border-ivory-400 py-3.5 text-[14px] font-semibold text-ink-900">Go to Home</button>
      </div>
    </div>
  );
}

function Nav() {
  const back = useStore((s) => s.obBack);
  const next = useStore((s) => s.obNext);
  return (
    <div className="mt-6 flex justify-between">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-bold text-ink-400"><Icon name="chevron-left" size={14} /> Back</button>
      <button onClick={next} className="rounded-[9px] bg-plum-600 px-5 py-2.5 text-[13.5px] font-bold text-white">Continue</button>
    </div>
  );
}
