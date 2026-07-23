'use client';

/**
 * StudioProperties  —  Right panel of Overlay Studio
 * Full properties panel for the active overlay.
 * Mirrors OverlayProperties from the Viewer but self-contained here.
 */

import { useOverlayStore }     from '@/store/overlayStore';
import { useOverlayTransform } from '@/hooks/useOverlayTransform';
import { formatDate }          from '@/lib/utils';

// ─── Tiny UI pieces ───────────────────────────────────────────────────────────
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-zinc-500 shrink-0">{label}</span>
      <span className="text-[11px] text-zinc-300 font-mono tabular-nums truncate text-right">{value ?? '—'}</span>
    </div>
  );
}

function NumInput({ label, value, step = 1, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 shrink-0 w-6">{label}</span>
      <input type="number" value={typeof value === 'number' ? parseFloat(value.toFixed(2)) : 0}
        step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1
                   text-xs text-zinc-200 font-mono text-right
                   focus:outline-none focus:border-amber-500 transition-colors" />
    </div>
  );
}

function Slider({ label, value, min, max, step, display, onChange }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-400 font-mono tabular-nums">{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded accent-amber-400" />
    </div>
  );
}

function IconBtn({ onClick, title, disabled, danger, children }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors
        ${danger
          ? 'border-red-800/40 text-red-400 hover:bg-red-500/10 disabled:opacity-30'
          : 'border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        } disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}

function ToggleBtn({ label, active, onClick, ac }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors
        ${active ? (ac || 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40')
                 : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'}`}>
      {label}
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Sec({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold px-1">{title}</p>
      {children}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function StudioProperties() {
  const overlays    = useOverlayStore((s) => s.overlays);
  const activeId    = useOverlayStore((s) => s.activeOverlayId);
  const undoStack   = useOverlayStore((s) => s.undoStack);
  const redoStack   = useOverlayStore((s) => s.redoStack);
  const setActiveId = useOverlayStore((s) => s.setActiveOverlayId);

  const {
    activeOverlay: ov,
    move, resize, rotate, setOpacity,
    setVisible, setLocked,
    bringForward, sendBackward, bringToFront, sendToBack,
    removeActive, duplicateActive, copyActive,
    handleUndo, handleRedo,
  } = useOverlayTransform();

  if (!ov) return null;

  const id = ov.id;

  return (
    <aside className="w-60 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <h2 className="text-xs font-semibold text-zinc-200 truncate flex-1">
          {ov.name ?? ov.architectureFile?.originalName ?? `Overlay #${id}`}
        </h2>
        <button onClick={() => setActiveId(null)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-3 space-y-5">

          {/* Transform — coordinates are in geo-degree space (lng/lat) */}
          <Sec title="Position &amp; Size">
            <div className="grid grid-cols-2 gap-1.5">
              <NumInput label="Lng"  value={ov.x}      step={0.00001} onChange={(v) => move(id, v, ov.y)} />
              <NumInput label="Lat"  value={ov.y}      step={0.00001} onChange={(v) => move(id, ov.x, v)} />
              <NumInput label="ΔLng" value={ov.width}  step={0.00001} onChange={(v) => resize(id, v, ov.height)} />
              <NumInput label="ΔLat" value={ov.height} step={0.00001} onChange={(v) => resize(id, ov.width, v)} />
            </div>
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* Rotation */}
          <Sec title="Rotation">
            <Slider label="Angle" value={ov.rotation} min={0} max={360} step={1}
              display={`${Math.round(ov.rotation)}°`} onChange={(v) => rotate(id, v)} />
            <NumInput label="°" value={ov.rotation} step={1} onChange={(v) => rotate(id, v)} />
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* Opacity */}
          <Sec title="Opacity">
            <Slider label="Opacity" value={ov.opacity} min={0} max={1} step={0.01}
              display={`${Math.round(ov.opacity * 100)}%`} onChange={(v) => setOpacity(id, v)} />
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* Layer */}
          <Sec title="Layer Order">
            <div className="grid grid-cols-4 gap-1">
              <IconBtn onClick={() => sendToBack(id)} title="Send to Back">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="17 18 12 23 7 18"/><polyline points="17 8 12 13 7 8"/>
                </svg>
              </IconBtn>
              <IconBtn onClick={() => sendBackward(id)} title="Send Backward">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="17 13 12 18 7 13"/>
                </svg>
              </IconBtn>
              <IconBtn onClick={() => bringForward(id)} title="Bring Forward">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="17 11 12 6 7 11"/>
                </svg>
              </IconBtn>
              <IconBtn onClick={() => bringToFront(id)} title="Bring to Front">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>
                </svg>
              </IconBtn>
            </div>
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono text-center">
              Layer {ov.zIndex ?? 1}
            </div>
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* State */}
          <Sec title="State">
            <div className="flex gap-2">
              <ToggleBtn label={ov.visible ? '👁 Visible' : '🚫 Hidden'} active={ov.visible}
                onClick={() => setVisible(id, !ov.visible)}
                ac="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" />
              <ToggleBtn label={ov.locked ? '🔒 Locked' : '🔓 Free'} active={ov.locked}
                onClick={() => setLocked(id, !ov.locked)}
                ac="bg-amber-500/15 text-amber-400 border-amber-500/30" />
            </div>
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* Undo / Redo */}
          <Sec title="History">
            <div className="flex gap-2">
              <button onClick={handleUndo} disabled={!undoStack.length}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-zinc-700
                           text-zinc-400 text-[11px] hover:bg-zinc-700 hover:text-zinc-200 transition-colors
                           disabled:opacity-30 disabled:cursor-not-allowed">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                </svg>
                Undo
              </button>
              <button onClick={handleRedo} disabled={!redoStack.length}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-zinc-700
                           text-zinc-400 text-[11px] hover:bg-zinc-700 hover:text-zinc-200 transition-colors
                           disabled:opacity-30 disabled:cursor-not-allowed">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.95"/>
                </svg>
                Redo
              </button>
            </div>
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* Actions */}
          <Sec title="Actions">
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => copyActive(id)}
                className="py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[11px] hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
                Copy
              </button>
              <button onClick={() => duplicateActive(id)}
                className="py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[11px] hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
                Duplicate
              </button>
            </div>
            <button onClick={() => removeActive(id)} disabled={ov.locked}
              className="w-full py-1.5 rounded-lg border border-red-800/40 text-red-400 text-[11px]
                         hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Delete Overlay
            </button>
          </Sec>

          <div className="h-px bg-zinc-800" />

          {/* Info */}
          <Sec title="Info">
            <Row label="ID"      value={`#${ov.id}`} />
            <Row label="Region"  value={ov.region?.name ?? (ov.regionId ? `#${ov.regionId}` : '—')} />
            <Row label="File"    value={ov.architectureFile?.originalName ?? `#${ov.architectureFileId}`} />
            <Row label="Layer"   value={ov.zIndex ?? 1} />
            <Row label="Created" value={formatDate(ov.createdAt)} />
            <Row label="Updated" value={formatDate(ov.updatedAt)} />
          </Sec>

        </div>
      </div>
    </aside>
  );
}
