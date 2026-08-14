import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@/lib/api';

export const fetchPlots = createAsyncThunk(
  'plots/fetchPlots',
  async ({ projectId, options }, { rejectWithValue }) => {
    try {
      const response = await api.getProjectPlots(projectId, options);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch plots');
    }
  }
);

export const fetchPlotById = createAsyncThunk(
  'plots/fetchPlotById',
  async (plotId, { rejectWithValue }) => {
    try {
      const response = await api.getProjectPlot(plotId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch plot');
    }
  }
);

export const createPlot = createAsyncThunk(
  'plots/createPlot',
  async ({ projectId, data }, { rejectWithValue }) => {
    try {
      const response = await api.createProjectPlot(projectId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create plot');
    }
  }
);

export const updatePlot = createAsyncThunk(
  'plots/updatePlot',
  async ({ projectId, plotId, data }, { rejectWithValue }) => {
    try {
      const response = await api.updateProjectPlot(projectId, plotId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update plot');
    }
  }
);

export const updatePlotAssignment = createAsyncThunk(
  'plots/updatePlotAssignment',
  async ({ projectId, plotId, assignmentData }, { rejectWithValue }) => {
    try {
      const response = await api.updateProjectPlotAssignment(projectId, plotId, assignmentData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update plot assignment');
    }
  }
);

export const deletePlot = createAsyncThunk(
  'plots/deletePlot',
  async ({ projectId, plotId }, { rejectWithValue }) => {
    try {
      await api.deleteProjectPlot(projectId, plotId);
      return { plotId };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete plot');
    }
  }
);

const initialState = {
  items: [],
  total: 0,
  page: 1,
  limit: 100, // typically high for map editors
  totalPages: 1,
  loading: false,
  error: null,
  filters: {
    search: '',
    statusId: '',
    assignment: '',
    sortBy: '',
    sortOrder: 'asc'
  }
};

const plotsSlice = createSlice({
  name: 'plots',
  initialState,
  reducers: {
    setPlotsFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPlotsPagination: (state, action) => {
      if (action.payload.page !== undefined) state.page = action.payload.page;
      if (action.payload.limit !== undefined) state.limit = action.payload.limit;
    },
    clearPlotsError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchPlots.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlots.fulfilled, (state, action) => {
        state.loading = false;
        // The API returns paginated data (data, meta) or array
        if (Array.isArray(action.payload)) {
          state.items = action.payload;
          state.total = action.payload.length;
        } else {
          state.items = action.payload.data || [];
          state.total = action.payload.meta?.total || 0;
          state.page = action.payload.meta?.page || state.page;
          state.totalPages = action.payload.meta?.totalPages || state.totalPages;
        }
      })
      .addCase(fetchPlots.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create
      .addCase(createPlot.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })

      // Update
      .addCase(updatePlot.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload };
        }
      })

      // Assignment
      .addCase(updatePlotAssignment.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload };
        }
      })

      // Delete
      .addCase(deletePlot.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p.id !== action.payload.plotId);
      });
  }
});

export const { setPlotsFilters, setPlotsPagination, clearPlotsError } = plotsSlice.actions;

export default plotsSlice.reducer;
