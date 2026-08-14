import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@/lib/api';

// Thunks
export const fetchConversions = createAsyncThunk(
  'conversions/fetchConversions',
  async (projectId, { rejectWithValue }) => {
    try {
      const response = await api.getCadConversions(projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch conversions');
    }
  }
);

export const deleteConversion = createAsyncThunk(
  'conversions/deleteConversion',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.deleteCadConversion(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete conversion');
    }
  }
);

export const renameConversion = createAsyncThunk(
  'conversions/renameConversion',
  async ({ id, newName }, { rejectWithValue }) => {
    try {
      const response = await api.renameCadConversion(id, newName);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to rename conversion');
    }
  }
);

export const updateConversion = createAsyncThunk(
  'conversions/updateConversion',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.updateCadConversion(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update conversion');
    }
  }
);

export const activateConversion = createAsyncThunk(
  'conversions/activateConversion',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.activateCadConversion(id);
      // Activation might return the activated layout, or multiple updated layouts
      // based on typical active/inactive logic
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to activate conversion');
    }
  }
);

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const conversionsSlice = createSlice({
  name: 'conversions',
  initialState,
  reducers: {
    clearConversionError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchConversions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversions.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchConversions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete
      .addCase(deleteConversion.fulfilled, (state, action) => {
        state.items = state.items.filter(c => c.id !== action.payload.id);
      })

      // Rename
      .addCase(renameConversion.fulfilled, (state, action) => {
        const index = state.items.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload };
        }
      })

      // Update
      .addCase(updateConversion.fulfilled, (state, action) => {
        const index = state.items.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload };
        }
      })

      // Activate
      .addCase(activateConversion.fulfilled, (state, action) => {
        // Typically, activating one layout makes all others in the same project inactive.
        // We will update local state to reflect this if possible,
        // but often we just re-fetch after activate to ensure consistency.
        // Here we'll optimistically mark the activated one and unmark others
        const activatedId = action.payload.id;
        state.items = state.items.map(item => ({
          ...item,
          isActive: item.id === activatedId
        }));
      });
  }
});

export const { clearConversionError } = conversionsSlice.actions;

export default conversionsSlice.reducer;
