'use client';

import { useCallback } from 'react';
import { useRegionStore, REGION_TOOL, REGION_SHAPE } from '@/store/regionStore';
import { useViewerStore } from '@/store/viewerStore';
import { createRegion } from '@/lib/api';
import RegionDrawLayer from './RegionDrawLayer';
import SaveRegionDialog from './SaveRegionDialog';

export default function RegionManager({ containerRef, projectId }) {
  const activeFile = useViewerStore((s) => s.activeFile);

  const setTool            = useRegionStore((s) => s.setTool);
  const pendingRegion      = useRegionStore((s) => s.pendingRegion);
  const clearPendingRegion = useRegionStore((s) => s.clearPendingRegion);
  const saving             = useRegionStore((s) => s.saving);
  const setSaving          = useRegionStore((s) => s.setSaving);
  const addRegion          = useRegionStore((s) => s.addRegion);
  const setActiveRegionId  = useRegionStore((s) => s.setActiveRegionId);

  const handleSaveRegion = useCallback(async (name) => {
    if (!activeFile || !pendingRegion) return;
    setSaving(true);
    try {
      const isPolygon = pendingRegion.shapeType === REGION_SHAPE.POLYGON;

      const payload = {
        architectureFileId: activeFile.id,
        name,
        shapeType:  pendingRegion.shapeType,
        pageNumber: 1,
        rotation:   0,
        scale:      1,
      };

      if (isPolygon) {
        payload.points = pendingRegion.points;
        // bounding box derived server-side from points, but send for safety
        payload.x      = pendingRegion.x;
        payload.y      = pendingRegion.y;
        payload.width  = pendingRegion.width;
        payload.height = pendingRegion.height;
      } else {
        payload.x      = pendingRegion.x;
        payload.y      = pendingRegion.y;
        payload.width  = pendingRegion.width;
        payload.height = pendingRegion.height;
      }

      const res = await createRegion(projectId, payload);
      const newRegion = res?.data ?? res;
      addRegion(newRegion);
      setActiveRegionId(newRegion?.id);
      clearPendingRegion();
      setTool(REGION_TOOL.NONE);
    } catch (err) {
      console.error('[RegionManager] save failed:', err.message);
    } finally {
      setSaving(false);
    }
  }, [activeFile, pendingRegion, projectId, addRegion, setActiveRegionId, clearPendingRegion, setTool, setSaving]);

  const handleCancelDialog = useCallback(() => {
    clearPendingRegion();
    setTool(REGION_TOOL.NONE);
  }, [clearPendingRegion, setTool]);

  return (
    <>
      <RegionDrawLayer containerRef={containerRef} />

      {pendingRegion && (
        <SaveRegionDialog
          rect={pendingRegion}
          shapeType={pendingRegion.shapeType}
          onSave={handleSaveRegion}
          onCancel={handleCancelDialog}
          saving={saving}
        />
      )}
    </>
  );
}
