import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@/lib/api';

// ─── Settings ────────────────────────────────────────────────────────────────
export const fetchAppearanceSettings = createAsyncThunk(
  'appearance/fetchAppearanceSettings',
  async (projectId, { rejectWithValue }) => {
    try {
      const response = await api.getProjectAppearanceSettings(projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch appearance settings');
    }
  }
);

export const updateAppearanceSettings = createAsyncThunk(
  'appearance/updateAppearanceSettings',
  async ({ projectId, data }, { rejectWithValue }) => {
    try {
      // First try to fetch, if it exists update, else create.
      // Usually the backend handles upsert, but just in case we use update.
      const response = await api.updateProjectAppearanceSettings(projectId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update appearance settings');
    }
  }
);

export const createAppearanceSettings = createAsyncThunk(
  'appearance/createAppearanceSettings',
  async ({ projectId, data }, { rejectWithValue }) => {
    try {
      const response = await api.createProjectAppearanceSettings(projectId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create appearance settings');
    }
  }
);

// ─── Boundaries ──────────────────────────────────────────────────────────────
export const fetchBoundaries = createAsyncThunk(
  'appearance/fetchBoundaries',
  async (projectId, { rejectWithValue }) => {
    try {
      const response = await api.getProjectBoundaries(projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch boundaries');
    }
  }
);

export const createBoundary = createAsyncThunk(
  'appearance/createBoundary',
  async ({ projectId, data }, { rejectWithValue }) => {
    try {
      const response = await api.createProjectBoundary(projectId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create boundary');
    }
  }
);

export const updateBoundary = createAsyncThunk(
  'appearance/updateBoundary',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.updateProjectBoundary(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update boundary');
    }
  }
);

export const deleteBoundary = createAsyncThunk(
  'appearance/deleteBoundary',
  async (id, { rejectWithValue }) => {
    try {
      await api.deleteProjectBoundary(id);
      return { id };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete boundary');
    }
  }
);

const initialState = {
  settings: null,
  boundaries: [],
  loading: false,
  error: null,
};

const appearanceSlice = createSlice({
  name: 'appearance',
  initialState,
  reducers: {
    clearAppearanceError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Settings
      .addCase(fetchAppearanceSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAppearanceSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
      })
      .addCase(fetchAppearanceSettings.rejected, (state, action) => {
        state.loading = false;
        // 404 is fine if it doesn't exist yet
        if (!action.payload?.includes('404')) {
          state.error = action.payload;
        }
      })

      // Update Settings
      .addCase(updateAppearanceSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
      })
      
      // Create Settings
      .addCase(createAppearanceSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
      })

      // Fetch Boundaries
      .addCase(fetchBoundaries.fulfilled, (state, action) => {
        state.boundaries = action.payload;
      })

      // Create Boundary
      .addCase(createBoundary.fulfilled, (state, action) => {
        state.boundaries.push(action.payload);
      })

      // Update Boundary
      .addCase(updateBoundary.fulfilled, (state, action) => {
        const index = state.boundaries.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.boundaries[index] = action.payload;
        }
      })

      // Delete Boundary
      .addCase(deleteBoundary.fulfilled, (state, action) => {
        state.boundaries = state.boundaries.filter(b => b.id !== action.payload.id);
      });
  }
});

export const { clearAppearanceError } = appearanceSlice.actions;

export default appearanceSlice.reducer;
