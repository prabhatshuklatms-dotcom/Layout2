import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@/lib/api';

export const fetchPlotStatuses = createAsyncThunk(
  'plotStatuses/fetchPlotStatuses',
  async ({ projectId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.getProjectPlotStatuses(projectId, params);
      return { response, params };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch plot statuses');
    }
  }
);

export const createPlotStatus = createAsyncThunk(
  'plotStatuses/createPlotStatus',
  async ({ projectId, body }, { rejectWithValue }) => {
    try {
      const response = await api.createProjectPlotStatus(projectId, body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create plot status');
    }
  }
);

export const updatePlotStatus = createAsyncThunk(
  'plotStatuses/updatePlotStatus',
  async ({ projectId, id, body }, { rejectWithValue }) => {
    try {
      const response = await api.updateProjectPlotStatus(projectId, id, body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update plot status');
    }
  }
);

export const deletePlotStatus = createAsyncThunk(
  'plotStatuses/deletePlotStatus',
  async ({ projectId, id }, { rejectWithValue }) => {
    try {
      await api.deleteProjectPlotStatus(projectId, id);
      return { id };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete plot status');
    }
  }
);

const initialState = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  loading: false,
  error: null,
};

const plotStatusesSlice = createSlice({
  name: 'plotStatuses',
  initialState,
  reducers: {
    clearPlotStatusesError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchPlotStatuses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlotStatuses.fulfilled, (state, action) => {
        state.loading = false;
        const { response, params } = action.payload;
        if (params.pagination === false) {
          state.items = response;
        } else {
          state.items = response.data || [];
          state.total = response.meta?.total || 0;
          state.page = response.meta?.page || state.page;
          state.totalPages = response.meta?.totalPages || state.totalPages;
        }
      })
      .addCase(fetchPlotStatuses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create
      .addCase(createPlotStatus.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })

      // Update
      .addCase(updatePlotStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })

      // Delete
      .addCase(deletePlotStatus.fulfilled, (state, action) => {
        state.items = state.items.filter(s => s.id !== action.payload.id);
      });
  }
});

export const { clearPlotStatusesError } = plotStatusesSlice.actions;

export default plotStatusesSlice.reducer;
