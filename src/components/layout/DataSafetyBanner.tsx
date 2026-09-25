import { useStore } from '../../store/store';
import { useStorageStatus } from '../../lib/storage';
import { Icon } from '../icons';

/** Persistent, app-wide warnings about data that is not (or may not be) safely stored. */
export function DataSafetyBanner() {
  const { saveError, loadNotice } = useStorageStatus();
  const exportBackup = useStore((s) => s.exportBackup);
  const openSettings = useStore((s) => s.openSettings);

  if (!saveError && !loadNotice) return null;
  return (
    <div role="alert" className="border-b border-bad-100 bg-bad-100/70 px-4 py-2.5 md:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-bad-600">
        <Icon name="alert" size={15} className="flex-none" />
        <span className="min-w-0 flex-1 font-semibold">{saveError || loadNotice}</span>
        {saveError ? (
          <button onClick={exportBackup} className="min-h-[36px] flex-none rounded-lg bg-bad-500 px-3 text-[12px] font-bold text-white">Export Backup Now</button>
        ) : (
          <>
            <button onClick={() => openSettings('Data')} className="min-h-[36px] flex-none rounded-lg border border-bad-500 px-3 text-[12px] font-bold">Open Data Settings</button>
            <button onClick={() => useStorageStatus.setState({ loadNotice: null })} aria-label="Dismiss" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg"><Icon name="close" size={14} /></button>
          </>
        )}
      </div>
    </div>
  );
}
