'use client';

import { useEffect, useCallback } from 'react';
import { useVersionStore, SAVE_STATE } from '@/store/versionStore';
import { useOverlayStore } from '@/store/overlayStore';
import { useSelectionStore } from '@/store/selectionStore';
import { useViewerStore } from '@/store/viewerStore';
import { getHistory, restoreVersion } from '@/lib/api';
import RestoreConfirmDialog from './RestoreConfirmDialog';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday)     return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ` ${time}`;
}

// ─── Version row ─────────────────────────────────────────────────────────────
function VersionRow({ version, onRestore }) {
  const isRestore = version.label?.startsWith('Restored from');

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg
                    hover:bg-zinc-800/60 transition-colors">
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className={`w-2 h-2 rounded-full shrink-0
          ${isRestore ? 'bg-indigo-400' : 'bg-zinc-600 group-hover:bg-zinc-400'}
          transition-colors`}
        />
        <div className="w-px flex-1 bg-zinc-800 mt-1 min-h-[16px]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-zinc-300 truncate">
            v{version.versionNumber}
            {isRestore && (
              <span className="ml-1.5 text-[9px] bg-indigo-500/20 text-indigo-400
                               border border-indigo-500/30 rounded px-1 py-0.5">
                restore
              </span>
            )}
          </span>
          <button
            onClick={() => onRestore(version)}
            className="opacity-0 group-hover:opacity-100 transition-opacity
                       text-[10px] text-indigo-400 hover:text-indigo-300
                       font-medium shrink-0"
          >
            Restore
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
          {version.label}
        </p>
        <p className="text-[10px] text-zinc-700 mt-0.5">
          {formatDateTime(version.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function HistoryPanel({ projectId }) {
  const historyOpen       = useVersionStore((s) => s.historyOpen);
  const versions          = useVersionStore((s) => s.versions);
  const setVersions       = useVersionStore((s) => s.setVersions);
  const restoring         = useVersionStore((s) => s.restoring);
  const setRestoring      = useVersionStore((s) => s.setRestoring);
  const restoreConfirmId  = useVersionStore((s) => s.restoreConfirmId);
  const setRestoreConfirmId = useVersionStore((s) => s.setRestoreConfirmId);
  const toggleHistory     = useVersionStore((s) => s.toggleHistory);
  const setSaveState      = useVersionStore((s) => s.setSaveState);
  const setLastSavedAt    = useVersionStore((s) => s.setLastSavedAt);

  // Store setters used during restore replay
  const setOverlays       = useOverlayStore((s) => s.setOverlays);
  const setSelections     = useSelectionStore((s) => s.setSelections);
  const setFiles          = useViewerStore((s) => s.setFiles);
  const setZoom           = useViewerStore((s) => s.setZoom);
  const setOffset         = useViewerStore((s) => s.setOffset);

  // Load history when panel opens
  useEffect(() => {
    if (!historyOpen || !projectId) return;
    getHistory(projectId)
      .then((res) => setVersions(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch((err) => console.error('[HistoryPanel] load failed', err.message));
  }, [historyOpen, projectId, setVersions]);

  const versionToConfirm = versions.find((v) => v.id === restoreConfirmId) ?? null;

  // ── Restore handler ────────────────────────────────────────────────────────
  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreConfirmId) return;
    setRestoring(true);
    try {
      const res = await restoreVersion(projectId, restoreConfirmId);
      const snapshot = res?.snapshot ?? res?.data?.snapshot;

      // Replay snapshot into stores
      if (snapshot.overlays)          setOverlays(snapshot.overlays);
      if (snapshot.selections)        setSelections(snapshot.selections);
      if (snapshot.architectureFiles) setFiles(snapshot.architectureFiles);
      if (snapshot.canvas) {
        if (snapshot.canvas.zoom   != null) setZoom(snapshot.canvas.zoom);
        if (snapshot.canvas.offset != null) setOffset(snapshot.canvas.offset);
      }

      // Refresh history list
      const histRes = await getHistory(projectId);
      setVersions(Array.isArray(histRes) ? histRes : (histRes?.data ?? []));
      setLastSavedAt(new Date());
      setSaveState(SAVE_STATE.SAVED);
    } catch (err) {
      console.error('[HistoryPanel] restore failed', err.message);
    } finally {
      setRestoring(false);
      setRestoreConfirmId(null);
    }
  }, [
    restoreConfirmId, projectId,
    setRestoring, setOverlays, setSelections, setFiles,
    setZoom, setOffset, setVersions, setLastSavedAt,
    setSaveState, setRestoreConfirmId,
  ]);

  if (!historyOpen) return null;

  return (
    <>
      <aside className="w-64 shrink-0 bg-zinc-900 border-l border-zinc-800
                        flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
          <div>
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Version History
            </h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {versions.length} version{versions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={toggleHistory}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-700">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 15"/>
              </svg>
              <p className="text-xs text-center px-4">
                No saved versions yet. The workspace saves automatically as you work.
              </p>
            </div>
          ) : (
            versions.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                onRestore={(ver) => setRestoreConfirmId(ver.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Restore confirmation dialog */}
      {restoreConfirmId && (
        <RestoreConfirmDialog
          version={versionToConfirm}
          loading={restoring}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreConfirmId(null)}
        />
      )}
    </>
  );
}

