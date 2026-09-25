import { useStore } from '../../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export function ImportReviewModal() {
  const pending = useStore((s) => s.pendingImport);
  const cancel = useStore((s) => s.cancelImport);
  const confirm = useStore((s) => s.confirmImport);
  const exportBackup = useStore((s) => s.exportBackup);
  const current = { name: useStore((s) => s.business.name), clients: useStore((s) => s.clients.length), appointments: useStore((s) => s.appointments.length) };
  if (!pending) return null;
  const { summary } = pending;
  const c = summary.counts;

  return (
    <Modal onClose={cancel} maxWidth={460} labelledBy="import-title">
      <h2 id="import-title" className="mb-1 font-serif text-[22px] font-medium text-ink-900">Restore this backup?</h2>
      <p className="mb-4 text-[12.5px] text-ink-400">{pending.fileName}</p>

      <div className="mb-4 rounded-xl border border-good-100 bg-good-100/40 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-good-600"><Icon name="check" size={14} /> Valid Lumora backup</div>
        <div className="text-[15px] font-bold text-ink-900">{summary.businessName}</div>
        <div className="mb-2 text-[12.5px] text-ink-500">{summary.exportedAt ? `Exported ${new Date(summary.exportedAt).toLocaleString()}` : 'Exported by an earlier version of Lumora'}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-700 sm:grid-cols-3">
          <span><b>{c.clients}</b> clients</span>
          <span><b>{c.appointments}</b> appointments</span>
          <span><b>{c.payments}</b> payments</span>
          <span><b>{c.services}</b> services</span>
          <span><b>{c.staff}</b> team</span>
          <span><b>{c.inventory}</b> inventory</span>
        </div>
      </div>

      {summary.warnings.map((w) => (
        <p key={w} className="mb-3 rounded-lg bg-warn-100/50 px-3 py-2 text-[12.5px] text-warn-600">{w}</p>
      ))}

      <div className="mb-5 rounded-xl border border-bad-100 bg-bad-100/40 p-4 text-[12.5px] leading-relaxed text-ink-700">
        This <b>replaces</b> everything currently in Lumora on this device ({current.name}: {current.clients} clients, {current.appointments} appointments). A recovery copy of your current data is saved first, so you can undo this from Settings → Data.
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={exportBackup} className="min-h-[44px] rounded-lg border border-ivory-400 px-3.5 py-2.5 text-[13px] font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600">Back Up Current Data First</button>
        <button onClick={cancel} className="min-h-[44px] rounded-lg border border-ivory-400 px-4 py-2.5 text-[13px] font-semibold text-ink-700">Cancel</button>
        <button onClick={confirm} className="min-h-[44px] rounded-lg bg-plum-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-plum-700">Replace &amp; Restore</button>
      </div>
    </Modal>
  );
}
