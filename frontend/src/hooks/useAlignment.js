import { useState, useEffect, useCallback } from 'react';
import { getAllProjects, getRegionsByProject, getBoundaries } from '@/lib/api';
import { alignService } from '@/services/architecture-map-align.service';

export function useAlignment() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  
  const [regions, setRegions] = useState([]);
  const [alignments, setAlignments] = useState([]);
  const [boundaries, setBoundaries] = useState([]);
  
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);

  // Fetch projects on mount
  useEffect(() => {
    let active = true;
    getAllProjects()
      .then(res => {
        if (!active) return;
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const activeProjects = list.filter(p => p.status === 'ACTIVE');
        setProjects(activeProjects);
        if (activeProjects.length > 0) {
          setActiveProjectId(activeProjects[0].id);
        }
        setLoadingProjects(false);
      })
      .catch(err => {
        if (active) {
          setError('Failed to load projects');
          setLoadingProjects(false);
        }
      });
    return () => { active = false; };
  }, []);

  // Fetch regions and alignments when active project changes
  useEffect(() => {
    if (!activeProjectId) return;
    let active = true;
    setLoadingData(true);
    
    Promise.all([
      getRegionsByProject(activeProjectId),
      alignService.findByProject(activeProjectId).catch(() => []),
      getBoundaries(activeProjectId)
    ])
      .then(([rRes, aRes, bRes]) => {
        if (!active) return;
        setRegions(Array.isArray(rRes) ? rRes : (rRes?.data ?? []));
        setAlignments(Array.isArray(aRes) ? aRes : (aRes?.data ?? []));
        setBoundaries((Array.isArray(bRes) ? bRes : (bRes?.data ?? [])).filter(b => b.visible !== false));
        setLoadingData(false);
      })
      .catch(err => {
        if (active) {
          setError('Failed to load data for project');
          setLoadingData(false);
        }
      });
      
    return () => { active = false; };
  }, [activeProjectId]);

  const saveAlignment = useCallback(async (alignmentPayload) => {
    try {
      let saved;
      // If it exists in state, update it, else create
      const existing = alignments.find(a => a.architectureRegionId === alignmentPayload.architectureRegionId);
      
      if (existing) {
        saved = await alignService.update(existing.id, alignmentPayload);
      } else {
        saved = await alignService.create({ ...alignmentPayload, projectId: activeProjectId });
      }
      
      const finalSaved = saved?.data ?? saved;
      
      setAlignments(prev => {
        const idx = prev.findIndex(a => a.architectureRegionId === finalSaved.architectureRegionId);
        
        // Preserve the nested architectureRegion object since the backend save response might omit joined relations
        const preservedRegion = (idx >= 0 ? prev[idx].architectureRegion : null) || alignmentPayload.architectureRegion;
        const completeSaved = { ...finalSaved, architectureRegion: preservedRegion };

        if (idx >= 0) {
          const next = [...prev];
          next[idx] = completeSaved;
          return next;
        }
        return [...prev, completeSaved];
      });
      
      return finalSaved;
    } catch (err) {
      throw err;
    }
  }, [alignments, activeProjectId]);

  const removeAlignment = useCallback(async (id) => {
    await alignService.remove(id);
    setAlignments(prev => prev.filter(a => a.id !== id));
  }, []);

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    regions,
    alignments,
    boundaries,
    loadingProjects,
    loadingData,
    error,
    saveAlignment,
    removeAlignment
  };
}
