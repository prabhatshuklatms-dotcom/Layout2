'use client';

import { useState, useEffect } from 'react';
import { useVersionStore, SAVE_STATE } from '@/store/versionStore';

/**
 * Returns a human-readable "time ago" string that re-renders every 15 s
 * so "Saved 2m ago" stays accurate without a page refresh.
 */
function useTimeAgo(date) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return '';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function SaveIndicator() {
  const saveState   = useVersionStore((s) => s.saveState);
  const lastSavedAt = useVersionStore((s) => s.lastSavedAt);
  const saveError   = useVersionStore((s) => s.saveError);
  const timeAgo     = useTimeAgo(lastSavedAt);

  if (saveState === SAVE_STATE.IDLE) return null;

  const configs = {
    [SAVE_STATE.PENDING]: {
      text:  '● Unsaved changes',
      color: 'text-amber-400',
      title: 'Changes are pending auto-save',
    },
    [SAVE_STATE.SAVING]: {
      spin:  true,
      text:  'Saving…',
      color: 'text-indigo-400',
      title: 'Saving workspace…',
    },
    [SAVE_STATE.SAVED]: {
      dot:   'bg-emerald-400',
      text:  timeAgo ? `Saved ${timeAgo}` : 'Saved',
      color: 'text-emerald-400',
      title: lastSavedAt ? `Last saved at ${lastSavedAt.toLocaleTimeString()}` : 'Saved',
    },
    [SAVE_STATE.ERROR]: {
      dot:   'bg-red-500',
      text:  'Save failed',
      color: 'text-red-400',
      title: saveError ?? 'Auto-save failed — changes may be lost',
    },
  };

  const cfg = configs[saveState];
  if (!cfg) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] font-medium select-none ${cfg.color}`}
      title={cfg.title}
    >
      {cfg.spin ? (
        <svg className="animate-spin w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
          <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : cfg.dot ? (
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      ) : null}
      <span className="hidden sm:inline whitespace-nowrap">{cfg.text}</span>
    </div>
  );
}
