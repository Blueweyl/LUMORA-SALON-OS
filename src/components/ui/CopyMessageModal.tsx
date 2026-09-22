import { useState } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';

export function CopyMessageModal() {
  const copyMessage = useStore((s) => s.copyMessage);
  const closeCopyMessage = useStore((s) => s.closeCopyMessage);
  const toast = useStore((s) => s.toast);
  const [copied, setCopied] = useState(false);

  if (!copyMessage) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyMessage.message);
    } catch {
      // clipboard unavailable — selection fallback still lets the user copy manually
    }
    setCopied(true);
    toast('Copied to clipboard');
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Modal onClose={closeCopyMessage} maxWidth={440}>
      <h2 className="mb-1 font-serif text-[20px] font-medium text-ink-900">{copyMessage.title}</h2>
      <p className="mb-4 text-[13px] text-ink-400">Lumora doesn't send messages automatically — copy this and paste it into text, email, or DM.</p>
      <div className="mb-5 whitespace-pre-wrap rounded-xl border border-ivory-400 bg-ivory-100 p-4 text-sm leading-relaxed text-ink-700">{copyMessage.message}</div>
      <div className="flex justify-end gap-2">
        <button onClick={closeCopyMessage} className="rounded-lg border border-ivory-400 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-plum-600 hover:text-plum-600">
          Close
        </button>
        <button onClick={onCopy} className="rounded-lg bg-plum-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-plum-700">
          {copied ? 'Copied ✓' : 'Copy Message'}
        </button>
      </div>
    </Modal>
  );
}
