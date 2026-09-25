import { create } from 'zustand';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import type { Domain } from '../store/types';

export const STORAGE_KEY = 'lumora-salon-os-v1';
export const RECOVERY_KEY = 'lumora-salon-os-recovery';
const CORRUPT_PREFIX = 'lumora-salon-os-unreadable-';

export interface StorageStatus {
  available: boolean; // false when the browser blocks localStorage (e.g. some private modes)
  lastSavedAt: number | null;
  saveError: string | null; // set when the latest save failed (storage full, blocked)
  sizeBytes: number;
  loadNotice: string | null; // shown once when stored data needed repair or couldn't be read
}

export const useStorageStatus = create<StorageStatus>(() => ({
  available: true,
  lastSavedAt: null,
  saveError: null,
  sizeBytes: 0,
  loadNotice: null,
}));

function ls(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__lumora_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

let storageRef: Storage | null | undefined;
function getStorage(): Storage | null {
  if (storageRef === undefined) {
    storageRef = ls();
    if (!storageRef) {
      useStorageStatus.setState({
        available: false,
        saveError: "This browser is blocking storage (private mode or strict settings), so changes won't be kept after you close the page. Open Lumora in a normal window, or export a backup before closing.",
      });
    }
  }
  return storageRef;
}

// Saves are skipped until the stored data has been read, so a failed/slow load can never overwrite it.
let hydrated = false;
export function markHydrated() {
  hydrated = true;
}

const GZ_PREFIX = 'GZ1:';
// Above this size (in characters) workspaces are gzip-compressed so years of history fit in
// the browser's ~5 MB localStorage quota. Small workspaces stay as plain, readable JSON.
export const COMPRESS_OVER_CHARS = 1_500_000;
const canGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function gzipToBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function base64Gunzip(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function keepUnreadable(s: Storage, raw: string) {
  try {
    s.setItem(`${CORRUPT_PREFIX}${Date.now()}`, raw);
  } catch {
    /* storage full — nothing more we can do */
  }
  useStorageStatus.setState({
    loadNotice: 'Your saved data could not be read, so Lumora started fresh. The unreadable copy was kept on this device. If you have a backup file, restore it from Settings → Data.',
  });
}

function reportSaveError(e: unknown) {
  const full = e instanceof DOMException ? e.name === 'QuotaExceededError' || e.code === 22 : (e as { name?: string })?.name === 'QuotaExceededError';
  useStorageStatus.setState({
    saveError: full
      ? 'Storage is full — your latest changes were NOT saved. Export a backup now, then clear old data you no longer need.'
      : 'Your latest changes could not be saved on this device. Export a backup now to keep them safe.',
  });
}

/* Writes are debounced: the whole workspace is serialized at most every SAVE_DELAY ms, not on every keystroke. */
const SAVE_DELAY = 300;
let pending: { name: string; value: unknown } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let writeSeq = 0;

async function write(name: string, value: unknown): Promise<void> {
  const s = getStorage();
  if (!s) return;
  const seq = ++writeSeq;
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (e) {
    reportSaveError(e);
    return;
  }
  let stored = text;
  if (text.length > COMPRESS_OVER_CHARS && canGzip()) {
    try {
      stored = GZ_PREFIX + (await gzipToBase64(text));
    } catch {
      stored = text;
    }
    if (seq !== writeSeq) return; // a newer save superseded this one while compressing
  }
  try {
    s.setItem(name, stored);
    useStorageStatus.setState({ lastSavedAt: Date.now(), saveError: null, sizeBytes: stored.length * 2 });
  } catch (e) {
    reportSaveError(e);
  }
}

/** Writes any pending change now. Resolves when it is on disk. */
export function flushStorage(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  if (pending) {
    const { name, value } = pending;
    pending = null;
    inFlight = write(name, value).finally(() => {
      inFlight = null;
    });
  }
  return inFlight ?? Promise.resolve();
}

export function hasUnsavedChanges(): boolean {
  return pending !== null || inFlight !== null;
}

let lastQueued: unknown = null;
function sameShallow(a: unknown, b: unknown): boolean {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

/** zustand persist storage: never throws, keeps unreadable data aside, reports save failures. */
export const persistStorage: PersistStorage<unknown> = {
  getItem: (name) => {
    const s = getStorage();
    if (!s) return null;
    let raw: string | null = null;
    try {
      raw = s.getItem(name);
    } catch {
      return null;
    }
    if (raw === null) return null;
    useStorageStatus.setState({ sizeBytes: raw.length * 2 });
    if (raw.startsWith(GZ_PREFIX)) {
      if (!canGzip()) {
        useStorageStatus.setState({ loadNotice: 'This browser is too old to open your saved data. Please use an up-to-date Chrome, Safari, Edge or Firefox.' });
        return null;
      }
      const stored = raw;
      return base64Gunzip(stored.slice(GZ_PREFIX.length))
        .then((text) => JSON.parse(text) as StorageValue<unknown>)
        .catch(() => {
          keepUnreadable(s, stored);
          return null;
        });
    }
    try {
      return JSON.parse(raw) as StorageValue<unknown>;
    } catch {
      keepUnreadable(s, raw);
      return null;
    }
  },
  setItem: (name, value) => {
    if (!hydrated) return;
    // zustand calls this on every state change (even opening a menu); skip when no saved field changed.
    if (sameShallow(lastQueued, value.state)) return;
    lastQueued = value.state;
    pending = { name, value };
    clearTimeout(timer);
    timer = setTimeout(() => void flushStorage(), SAVE_DELAY);
  },
  removeItem: (name) => {
    try {
      getStorage()?.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Save immediately when the page is hidden or closed, and warn if a save is still running.
  window.addEventListener('pagehide', () => void flushStorage());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushStorage();
  });
  window.addEventListener('beforeunload', (e) => {
    void flushStorage();
    if (hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

export interface RecoverySnapshot {
  createdAt: string;
  reason: string;
  data: Domain;
}

const RECOVERY_META_KEY = `${RECOVERY_KEY}-info`;

/** Saves a copy of the current workspace before a destructive action. Resolves false if it couldn't be stored. */
export async function saveRecoverySnapshot(data: Domain, reason: string): Promise<boolean> {
  const s = getStorage();
  if (!s) return false;
  const snap: RecoverySnapshot = { createdAt: new Date().toISOString(), reason, data };
  let text = JSON.stringify(snap);
  try {
    if (text.length > COMPRESS_OVER_CHARS / 3 && canGzip()) text = GZ_PREFIX + (await gzipToBase64(text));
    // Drop the old copy first so replacing it can't fail for lack of space.
    s.removeItem(RECOVERY_KEY);
    s.setItem(RECOVERY_KEY, text);
    s.setItem(RECOVERY_META_KEY, JSON.stringify({ createdAt: snap.createdAt, reason }));
    return true;
  } catch {
    return false;
  }
}

/** When/why the recovery copy was made — cheap to read, for display. */
export function recoveryInfo(): { createdAt: string; reason: string } | null {
  const s = getStorage();
  if (!s) return null;
  try {
    if (!s.getItem(RECOVERY_KEY)) return null;
    const meta = s.getItem(RECOVERY_META_KEY);
    if (meta) return JSON.parse(meta);
    return { createdAt: new Date(0).toISOString(), reason: 'Earlier change' };
  } catch {
    return null;
  }
}

export async function readRecoverySnapshot(): Promise<RecoverySnapshot | null> {
  const s = getStorage();
  if (!s) return null;
  try {
    let raw = s.getItem(RECOVERY_KEY);
    if (!raw) return null;
    if (raw.startsWith(GZ_PREFIX)) raw = await base64Gunzip(raw.slice(GZ_PREFIX.length));
    const parsed = JSON.parse(raw) as RecoverySnapshot;
    if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.data !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** True when real (non-demo) data exists and hasn't been backed up for a week. */
export function isBackupStale(lastBackupAt: string | null, demoMode: boolean, clientCount: number): boolean {
  if (demoMode || clientCount === 0) return false;
  if (!lastBackupAt) return true;
  return Date.now() - new Date(lastBackupAt).getTime() > 7 * 86400000;
}
