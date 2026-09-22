import { useState } from 'react';
import { useStore } from '../store/store';
import { Icon } from '../components/icons';
import { formatBirthday, formatDateShort } from '../lib/dates';
import {
  getRetentionGroups,
  getReviewCandidates,
  getReferralCandidates,
  getUpcomingBirthdays,
  potentialRevenue,
  type RetentionEntry,
} from '../lib/selectors';
import { TIER_COLORS, TIER_LABEL } from '../lib/loyalty';
import type { GrowTab } from '../store/types';
import type { ContentPlatform, ContentStage } from '../types';

const TABS: { key: GrowTab; label: string }[] = [
  { key: 'Campaigns', label: 'Revenue Opportunities' },
  { key: 'Retention', label: 'Retention' },
  { key: 'Loyalty', label: 'Loyalty' },
  { key: 'Reviews', label: 'Reviews & Referrals' },
  { key: 'Content', label: 'Content Planner' },
];

export function Grow() {
  const tab = useStore((s) => s.growTab);
  const setTab = useStore((s) => s.setGrowTab);

  return (
    <div className="mx-auto max-w-[1150px] animate-lum-fade">
      <h1 className="mb-4 font-serif text-[28px] font-medium text-ink-900">Grow</h1>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-ivory-400">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`mr-5 border-b-2 pb-2.5 text-[13.5px] font-bold whitespace-nowrap ${tab === t.key ? 'border-plum-600 text-plum-600' : 'border-transparent text-ink-400'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'Campaigns' && <OpportunitiesTab />}
      {tab === 'Retention' && <RetentionTab />}
      {tab === 'Loyalty' && <LoyaltyTab />}
      {tab === 'Reviews' && <ReviewsTab />}
      {tab === 'Content' && <ContentTab />}
    </div>
  );
}

function OpportunityCard({ icon, title, subtitle, cta, onClick }: { icon: string; title: string; subtitle: string; cta: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-ivory-400 bg-white p-5">
      <div className="flex items-start gap-3.5">
        <span className="text-[22px] leading-none">{icon}</span>
        <div>
          <div className="text-[14.5px] font-bold text-ink-900">{title}</div>
          <div className="text-[12.5px] text-ink-500">{subtitle}</div>
        </div>
      </div>
      <button onClick={onClick} className="flex-none rounded-[9px] bg-plum-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-plum-700 whitespace-nowrap">{cta}</button>
    </div>
  );
}

function OpportunitiesTab() {
  const state = useStore((s) => s);
  const setTab = useStore((s) => s.setGrowTab);
  const showCopyMessage = useStore((s) => s.showCopyMessage);
  const birthdays = getUpcomingBirthdays(state, 30);
  const { dueNow, overdue, lost } = getRetentionGroups(state);
  const overdueCount = dueNow.length + overdue.length;
  const reviewCandidates = getReviewCandidates(state);
  const referralCandidates = getReferralCandidates(state);
  const inactive = lost.length;

  return (
    <div className="flex flex-col gap-3.5">
      {birthdays.length > 0 && (
        <OpportunityCard
          icon="🎂"
          title={`${birthdays.length} upcoming birthday${birthdays.length === 1 ? '' : 's'}`}
          subtitle={birthdays.slice(0, 3).map((b) => `${b.client.name.split(' ')[0]} (${formatBirthday(b.client.birthday)})`).join(', ')}
          cta="Create Birthday Offer"
          onClick={() => showCopyMessage('Birthday Offer', `🎉 Happy birthday month from ${state.business.name}! Enjoy 15% off any service this month as our gift to you. Reply to book your spot.`)}
        />
      )}
      {overdueCount > 0 && (
        <OpportunityCard
          icon="💇"
          title={`${overdueCount} overdue client${overdueCount === 1 ? '' : 's'}`}
          subtitle={`Potential revenue: ${state.business.currencySymbol}${potentialRevenue(state, [...dueNow, ...overdue])}`}
          cta="Start Win-Back"
          onClick={() => setTab('Retention')}
        />
      )}
      {reviewCandidates.length > 0 && (
        <OpportunityCard
          icon="⭐"
          title={`${reviewCandidates.length} client${reviewCandidates.length === 1 ? '' : 's'} ready for a review request`}
          subtitle="Recently completed a visit — a great time to ask."
          cta="View"
          onClick={() => setTab('Reviews')}
        />
      )}
      {referralCandidates.length > 0 && (
        <OpportunityCard
          icon="💕"
          title={`${referralCandidates.length} VIP client${referralCandidates.length === 1 ? '' : 's'} eligible for referral reward`}
          subtitle="Your most loyal clients are your best referral source."
          cta="View"
          onClick={() => setTab('Reviews')}
        />
      )}
      {inactive > 0 && (
        <OpportunityCard
          icon="💤"
          title={`${inactive} client${inactive === 1 ? '' : 's'} inactive 90+ days`}
          subtitle="Time for a win-back offer before they're gone for good."
          cta="Start Win-Back"
          onClick={() => setTab('Retention')}
        />
      )}
    </div>
  );
}

function RetentionGroup({ title, color, entries, template }: { title: string; color: string; entries: RetentionEntry[]; template: (name: string) => string }) {
  const state = useStore((s) => s);
  const showCopyMessage = useStore((s) => s.showCopyMessage);
  const openClient = useStore((s) => s.openClient);
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ivory-400 bg-white p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="text-[15px] font-bold text-ink-900">{title}</span>
          <span className="text-[13px] text-ink-400">{entries.length} client{entries.length === 1 ? '' : 's'} · ~{state.business.currencySymbol}{potentialRevenue(state, entries)} potential</span>
        </div>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} className="text-ink-400" />
      </button>
      {open && (
        <div className="mt-3.5 flex flex-col gap-1.5 border-t border-ivory-200 pt-3.5">
          {entries.map((e) => (
            <div key={e.client.id} className="flex items-center justify-between rounded-lg px-1 py-1.5">
              <button onClick={() => openClient(e.client.id)} className="text-left text-[13.5px] font-semibold text-ink-900 hover:text-plum-600">
                {e.client.name} <span className="font-normal text-ink-400">· {e.daysSince}d since last visit</span>
              </button>
              <button
                onClick={() => showCopyMessage('Rebooking Message', template(e.client.name.split(' ')[0]))}
                className="rounded-md border border-ivory-400 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-600 hover:border-plum-600 hover:text-plum-600"
              >
                Copy Message
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RetentionTab() {
  const state = useStore((s) => s);
  const { dueSoon, dueNow, overdue, lost } = getRetentionGroups(state);
  const bizName = state.business.name;

  return (
    <div className="flex flex-col gap-3.5">
      <RetentionGroup title="Due Soon" color="var(--color-plum-600)" entries={dueSoon} template={(n) => `Hi ${n}! You're coming up on your usual rebooking window at ${bizName}. Want me to hold your favorite time?`} />
      <RetentionGroup title="Due Now" color="var(--color-warn-500)" entries={dueNow} template={(n) => `Hi ${n}! It's about time for your next visit at ${bizName} — shall I book you in this week?`} />
      <RetentionGroup title="Overdue" color="var(--color-bad-500)" entries={overdue} template={(n) => `Hi ${n}, we miss you at ${bizName}! It's been a while since your last visit — book now and we'll take great care of you.`} />
      <RetentionGroup title="Lost" color="var(--color-ink-400)" entries={lost} template={(n) => `Hi ${n}, it's been a few months since we've seen you at ${bizName}. Come back this month and enjoy 15% off to welcome you back!`} />
      {dueSoon.length === 0 && dueNow.length === 0 && overdue.length === 0 && lost.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ivory-400 py-12 text-center text-[13px] text-ink-400">Everyone's on track — no rebooking outreach needed right now.</div>
      )}
    </div>
  );
}

function LoyaltyTab() {
  const state = useStore((s) => s);
  const redeem = useStore((s) => s.redeemReward);
  const sorted = [...state.clients].filter((c) => c.loyaltyPoints > 0).sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-ivory-400 bg-white">
        <div className="border-b border-ivory-400 px-5 py-3.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Client Points</div>
        {sorted.map((c) => {
          const tierColors = TIER_COLORS[c.vipTier];
          const nextReward = [...state.loyaltyRewards].sort((a, b) => a.pointsCost - b.pointsCost).find((r) => r.pointsCost > c.loyaltyPoints);
          return (
            <div key={c.id} className="flex items-center justify-between border-t border-ivory-200 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
                  {c.name}
                  {c.vipTier !== 'none' && <span className="rounded-full px-2 py-[2px] text-[10px] font-bold" style={{ background: tierColors.bg, color: tierColors.text }}>{TIER_LABEL[c.vipTier]}</span>}
                </div>
                <div className="text-[12px] text-ink-400">{c.loyaltyPoints} points{nextReward ? ` · ${nextReward.pointsCost - c.loyaltyPoints} until ${nextReward.label}` : ' · Top tier unlocked'}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-ivory-400 bg-white p-5">
        <div className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Rewards Catalog</div>
        <div className="flex flex-col gap-2">
          {state.loyaltyRewards.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-ivory-400 px-3.5 py-2.5">
              <div>
                <div className="text-[13px] font-bold text-ink-900">{r.label}</div>
                <div className="text-[11.5px] text-ink-400">{r.pointsCost} pts</div>
              </div>
              <RedeemPicker rewardId={r.id} onRedeem={redeem} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RedeemPicker({ rewardId, onRedeem }: { rewardId: string; onRedeem: (clientId: string, rewardId: string) => void }) {
  const allClients = useStore((s) => s.clients);
  const clients = allClients.filter((c) => c.loyaltyPoints > 0);
  const [clientId, setClientId] = useState('');
  return (
    <div className="flex gap-1.5">
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded-md border border-ivory-300 bg-white px-2 py-1.5 text-[11.5px]">
        <option value="">Client…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        onClick={() => clientId && onRedeem(clientId, rewardId)}
        className="rounded-md bg-plum-100 px-2.5 py-1.5 text-[11px] font-bold text-plum-600 hover:bg-plum-600 hover:text-white"
      >
        Redeem
      </button>
    </div>
  );
}

function ReviewsTab() {
  const state = useStore((s) => s);
  const showCopyMessage = useStore((s) => s.showCopyMessage);
  const reviewCandidates = getReviewCandidates(state);
  const referralCandidates = getReferralCandidates(state);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-ivory-400 bg-white p-5">
        <div className="mb-3.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-400"><Icon name="star" size={13} /> Ready for a Review</div>
        {reviewCandidates.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-400">No recent completions yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {reviewCandidates.map(({ client }) => (
              <div key={client.id} className="flex items-center justify-between rounded-lg border border-ivory-300 px-3 py-2.5">
                <span className="text-[13.5px] font-semibold text-ink-900">{client.name}</span>
                <button
                  onClick={() => showCopyMessage('Review Request', `Hi ${client.name.split(' ')[0]}! Thanks so much for coming in — we'd love it if you could share a quick review of your visit. It really helps our small business. 💛 [Review link]`)}
                  className="rounded-md border border-ivory-400 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-600 hover:border-plum-600 hover:text-plum-600"
                >
                  Copy Message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-ivory-400 bg-white p-5">
        <div className="mb-3.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-400"><Icon name="gift" size={13} /> Referral-Eligible VIPs</div>
        {referralCandidates.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-400">No VIP clients yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {referralCandidates.map((client) => (
              <div key={client.id} className="flex items-center justify-between rounded-lg border border-ivory-300 px-3 py-2.5">
                <span className="text-[13.5px] font-semibold text-ink-900">{client.name}</span>
                <button
                  onClick={() => showCopyMessage('Referral Offer', `Hi ${client.name.split(' ')[0]}! As one of our favorite clients, we'd love your referrals 💕 Send a friend our way and you'll both get $15 off your next visit.`)}
                  className="rounded-md border border-ivory-400 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-600 hover:border-plum-600 hover:text-plum-600"
                >
                  Copy Message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STAGES: ContentStage[] = ['idea', 'draft', 'scheduled', 'posted'];
const STAGE_LABEL: Record<ContentStage, string> = { idea: 'Idea', draft: 'Draft', scheduled: 'Scheduled', posted: 'Posted' };
const TEMPLATES = ['Before/After', 'Transformation', 'Last-Minute Opening', 'New Service', 'Review', 'Product Spotlight', 'Birthday Promo', 'Seasonal Offer'];
const PLATFORMS: ContentPlatform[] = ['Instagram', 'TikTok', 'Pinterest', 'Facebook'];

function ContentTab() {
  const state = useStore((s) => s);
  const moveStage = useStore((s) => s.moveContentStage);
  const deleteItem = useStore((s) => s.deleteContentItem);
  const addItem = useStore((s) => s.addContentItem);
  const [form, setForm] = useState({ title: '', platform: 'Instagram' as ContentPlatform, template: TEMPLATES[0] });
  const [showForm, setShowForm] = useState(false);

  const submit = () => {
    if (!form.title.trim()) return;
    addItem(form);
    setForm({ title: '', platform: 'Instagram', template: TEMPLATES[0] });
    setShowForm(false);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="rounded-[9px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">+ New Content Idea</button>
      </div>
      {showForm && (
        <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-2xl border border-ivory-400 bg-white p-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Idea title" className="min-w-[180px] flex-1 rounded-[10px] border border-ivory-400 px-3.5 py-2.5 text-[13.5px]" />
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as ContentPlatform })} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[13.5px]">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} className="rounded-[10px] border border-ivory-400 bg-white px-3.5 py-2.5 text-[13.5px]">
            {TEMPLATES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button onClick={submit} className="rounded-[10px] bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white">Add</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-2xl border border-ivory-400 bg-white p-3.5">
            <div className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">{STAGE_LABEL[stage]} · {state.content.filter((c) => c.stage === stage).length}</div>
            <div className="flex flex-col gap-2">
              {state.content.filter((c) => c.stage === stage).map((c) => (
                <div key={c.id} className="rounded-xl border border-ivory-300 p-3">
                  <div className="mb-1 text-[13px] font-bold text-ink-900">{c.title}</div>
                  <div className="mb-2 text-[11px] text-ink-400">{c.platform} · {c.template}{c.date ? ` · ${formatDateShort(c.date)}` : ''}</div>
                  <div className="flex gap-1.5">
                    {stage !== 'posted' && (
                      <button onClick={() => moveStage(c.id, STAGES[STAGES.indexOf(stage) + 1])} className="rounded-md bg-plum-100 px-2 py-1 text-[10.5px] font-bold text-plum-600">
                        → {STAGE_LABEL[STAGES[STAGES.indexOf(stage) + 1]]}
                      </button>
                    )}
                    <button onClick={() => deleteItem(c.id)} className="rounded-md border border-ivory-300 px-2 py-1 text-[10.5px] text-ink-400 hover:border-bad-500 hover:text-bad-500">Remove</button>
                  </div>
                </div>
              ))}
              {state.content.filter((c) => c.stage === stage).length === 0 && <p className="py-3 text-center text-[12px] text-ink-300">Empty</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
