'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Virtuoso } from 'react-virtuoso';
import LayerToolbar     from './LayerToolbar';
import LayerItem        from './LayerItem';
import LayerContextMenu from './LayerContextMenu';
import { useLayerStore }        from '@/store/layerStore';
import { useViewerStore }       from '@/store/viewerStore';
import { createLayerGroup, deleteLayerGroup, updateLayerGroup, updateOverlay } from '@/lib/api';
import { useOverlayTransform }  from '@/hooks/useOverlayTransform';

// ─── Flatten tree ────────────────────────────────────────────────────────────
function flattenTree(nodes, depth = 0) {
  let result = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.type === 'group' && node.expanded && node.children) {
      result = result.concat(flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LayerPanel() {
  // FIX: viewerStore stores the project as `project`, not `activeProject`
  const project = useViewerStore((s) => s.project);

  const layerTree         = useLayerStore((s) => s.layerTree);
  const fetchLayers       = useLayerStore((s) => s.fetchLayers);
  const updateItemLocally = useLayerStore((s) => s.updateItemLocally);
  const searchQuery       = useLayerStore((s) => s.searchQuery);
  const filterVisible     = useLayerStore((s) => s.filterVisible);
  const filterHidden      = useLayerStore((s) => s.filterHidden);
  const filterLocked      = useLayerStore((s) => s.filterLocked);
  const filterUnlocked    = useLayerStore((s) => s.filterUnlocked);

  const {
    setVisible, setLocked, removeActive,
    bringForward, sendBackward, bringToFront, sendToBack,
    duplicateActive, setZIndex,
  } = useOverlayTransform();

  const [selectedId,   setSelectedId]   = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [contextMenu,  setContextMenu]  = useState(null);

  // Reload layers whenever the project changes
  useEffect(() => {
    if (project?.id) fetchLayers(project.id);
  }, [project?.id, fetchLayers]);

  // ── Flatten + filter ───────────────────────────────────────────────────────
  const flattened = useMemo(() => {
    let flat = flattenTree(layerTree);
    return flat.filter((item) => {
      const name = String(item.name || `Layer ${item.id}`).toLowerCase();
      if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
      if (!filterVisible  && item.visible !== false)  return false;
      if (!filterHidden   && item.visible === false)  return false;
      if (!filterLocked   && item.locked  === true)   return false;
      if (!filterUnlocked && item.locked  !== true)   return false;
      return true;
    });
  }, [layerTree, searchQuery, filterVisible, filterHidden, filterLocked, filterUnlocked]);

  // ── DnD ───────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const aItem = flattened.find((x) => `${x.type}-${x.id}` === active.id);
    const oItem = flattened.find((x) => `${x.type}-${x.id}` === over.id);
    if (aItem?.type === 'layer' && oItem?.type === 'layer') {
      setZIndex(aItem.id, oItem.zIndex);
      setTimeout(() => { if (project?.id) fetchLayers(project.id); }, 300);
    }
  }, [flattened, setZIndex, fetchLayers, project?.id]);

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  const handleCreateGroup = useCallback(async () => {
    if (!project?.id) return;
    try {
      await createLayerGroup({ projectId: project.id, name: 'New Group', expanded: true });
      fetchLayers(project.id);
    } catch (e) { console.error(e); }
  }, [project?.id, fetchLayers]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedId) return;
    try {
      if (selectedType === 'group') await deleteLayerGroup(selectedId);
      else await removeActive(selectedId);
      setSelectedId(null);
      setSelectedType(null);
      if (project?.id) fetchLayers(project.id);
    } catch (e) { console.error(e); }
  }, [selectedId, selectedType, removeActive, fetchLayers, project?.id]);

  const handleRename = useCallback(async (id, type, newName) => {
    if (!newName?.trim()) return;
    updateItemLocally(id, type, { name: newName.trim() });
    try {
      if (type === 'group') {
        await updateLayerGroup(id, { name: newName.trim() });
      } else {
        await updateOverlay(id, { name: newName.trim() });
      }
    } catch (e) {
      console.error('[LayerPanel] rename failed:', e);
      if (project?.id) fetchLayers(project.id);
    }
  }, [updateItemLocally, fetchLayers, project?.id]);

  const handleToggleExpand = useCallback(async (id, expanded) => {
    updateItemLocally(id, 'group', { expanded });
    try { await updateLayerGroup(id, { expanded }); }
    catch { if (project?.id) fetchLayers(project.id); }
  }, [updateItemLocally, fetchLayers, project?.id]);

  const handleToggleVisibility = useCallback(async (id, type, visible) => {
    updateItemLocally(id, type, { visible });
    if (type === 'layer') setVisible(id, visible);
    else { await updateLayerGroup(id, { visible }); if (project?.id) fetchLayers(project.id); }
  }, [updateItemLocally, setVisible, fetchLayers, project?.id]);

  const handleToggleLock = useCallback(async (id, type, locked) => {
    updateItemLocally(id, type, { locked });
    if (type === 'layer') setLocked(id, locked);
    else { await updateLayerGroup(id, { locked }); if (project?.id) fetchLayers(project.id); }
  }, [updateItemLocally, setLocked, fetchLayers, project?.id]);

  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <LayerToolbar
        onCreateGroup={handleCreateGroup}
        onDeleteSelected={handleDeleteSelected}
        selectedCount={selectedId ? 1 : 0}
      />

      <div className="flex-1 overflow-hidden">
        {flattened.length === 0 ? (
          <div className="text-[11px] text-zinc-700 text-center mt-6 px-3 leading-relaxed">
            {project?.id
              ? 'No layers yet. Place an overlay to create one.'
              : 'Open a project to see layers.'}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flattened.map((f) => `${f.type}-${f.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <Virtuoso
                data={flattened}
                className="h-full scrollbar-thin"
                itemContent={(_, item) => (
                  <LayerItem
                    key={`${item.type}-${item.id}`}
                    item={item}
                    depth={item.depth}
                    isSelected={selectedId === item.id && selectedType === item.type}
                    onSelect={(id, type) => { setSelectedId(id); setSelectedType(type); }}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleLock={handleToggleLock}
                    onToggleExpand={handleToggleExpand}
                    onContextMenu={handleContextMenu}
                    onRename={handleRename}
                  />
                )}
              />
            </SortableContext>
          </DndContext>
        )}
      </div>

      {contextMenu && (
        <LayerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onRename={(i) => {
            // Trigger inline edit by dispatching a custom event that LayerItem listens to
            // Since LayerItem manages its own edit state, we re-use handleRename
            // but first show a native fallback only if item is not visible
            const name = window.prompt('New name:', i.name || '');
            if (name?.trim()) handleRename(i.id, i.type, name.trim());
          }}
          onDuplicate={(i)    => duplicateActive(i.id)}
          onDelete={(i)       => { setSelectedId(i.id); setSelectedType(i.type); handleDeleteSelected(); }}
          onBringForward={(i) => bringForward(i.id)}
          onSendBackward={(i) => sendBackward(i.id)}
          onBringToFront={(i) => bringToFront(i.id)}
          onSendToBack={(i)   => sendToBack(i.id)}
        />
      )}
    </div>
  );
}
