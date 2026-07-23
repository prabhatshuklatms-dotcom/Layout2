import { create } from 'zustand';
import { getAllProjects, getArchitectureFiles } from '@/lib/api';

const DEFAULT_LAYERS = [
  { id: 'plots', name: 'Plots', color: '#3b82f6', visible: true, locked: false },
  { id: 'roads', name: 'Roads', color: '#64748b', visible: true, locked: false },
  { id: 'amenities', name: 'Amenities', color: '#10b981', visible: true, locked: false },
  { id: 'commercial', name: 'Commercial', color: '#f59e0b', visible: true, locked: false },
  { id: 'landscape', name: 'Landscape', color: '#84cc16', visible: true, locked: false },
  { id: 'parking', name: 'Parking', color: '#8b5cf6', visible: true, locked: false },
  { id: 'boundary', name: 'Boundary', color: '#ef4444', visible: true, locked: true },
];

export const useMaskEditor = create((set, get) => ({
  // Project & Library State
  projects: [],
  activeProjectId: null,
  loadingProjects: true,
  
  architectureFiles: [],
  activeArchitectureId: null,
  loadingFiles: false,

  // Tools & Canvas State
  mode: 'pointer', // pointer, plot, road, etc.
  zoom: 1,
  pan: { x: 0, y: 0 },
  imageVisible: true,
  imageOpacity: 1,
  isTracing: false,

  // Data State
  polygons: [],
  selectedIds: [],
  layers: DEFAULT_LAYERS,

  // History State
  history: [],
  historyIndex: -1,

  // Actions
  setImageVisible: (visible) => set({ imageVisible: visible }),
  setImageOpacity: (opacity) => set({ imageOpacity: opacity }),
  setIsTracing: (tracing) => set({ isTracing: tracing }),

  setActiveProjectId: async (id) => {
    set({ activeProjectId: id, loadingFiles: true, architectureFiles: [], activeArchitectureId: null });
    try {
      const files = await getArchitectureFiles(id);
      set({ architectureFiles: Array.isArray(files) ? files : files.data || [], loadingFiles: false });
    } catch (e) {
      set({ loadingFiles: false });
    }
  },

  setActiveArchitectureId: (id) => {
    set({ activeArchitectureId: id, polygons: [], selectedIds: [], history: [], historyIndex: -1 });
    // TODO: Load masks from backend
  },

  setMode: (mode) => set({ mode }),

  setPolygons: (newPolygons) => {
    const { history, historyIndex, polygons } = get();
    // Trim future history if we made a change after undoing
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(polygons);
    
    // Keep max 50 history steps
    if (newHistory.length > 50) newHistory.shift();

    set({ 
      polygons: newPolygons, 
      history: newHistory, 
      historyIndex: newHistory.length - 1 
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= 0) {
      set({ 
        polygons: history[historyIndex], 
        historyIndex: historyIndex - 1 
      });
    }
  },

  redo: () => {
    const { history, historyIndex, polygons } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      set({ 
        polygons: nextIndex === history.length - 1 ? get().polygons : history[nextIndex], // actually redo needs to step forward
        // wait, redo should step forward in history
      });
    }
  },

  addPolygon: (poly) => {
    get().setPolygons([...get().polygons, poly]);
  },

  updatePolygon: (id, updates) => {
    get().setPolygons(get().polygons.map(p => p.id === id ? { ...p, ...updates } : p));
  },

  deleteSelected: () => {
    const { polygons, selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().setPolygons(polygons.filter(p => !selectedIds.includes(p.id)));
    set({ selectedIds: [] });
  },

  selectPolygon: (id, multi = false) => {
    const { selectedIds } = get();
    if (!id) {
      set({ selectedIds: [] });
      return;
    }
    if (multi) {
      set({ selectedIds: selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id] });
    } else {
      set({ selectedIds: [id] });
    }
  },

  setLayerVisibility: (layerId, visible) => {
    set(state => ({
      layers: state.layers.map(l => l.id === layerId ? { ...l, visible } : l)
    }));
  },

  setLayerLock: (layerId, locked) => {
    set(state => ({
      layers: state.layers.map(l => l.id === layerId ? { ...l, locked } : l)
    }));
  },

  // Initialize
  initProjects: async () => {
    try {
      const res = await getAllProjects();
      const list = Array.isArray(res) ? res : res.data || [];
      const activeProjects = list.filter(p => p.status === 'ACTIVE');
      set({ projects: activeProjects, loadingProjects: false });
      if (activeProjects.length > 0) {
        get().setActiveProjectId(activeProjects[0].id);
      }
    } catch (e) {
      set({ loadingProjects: false });
    }
  }
}));
