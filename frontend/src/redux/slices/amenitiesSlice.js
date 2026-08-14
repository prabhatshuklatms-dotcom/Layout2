import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@/lib/api';

// ─── Master Amenities ────────────────────────────────────────────────────────
export const fetchAmenities = createAsyncThunk(
  'amenities/fetchAmenities',
  async (options = {}, { rejectWithValue }) => {
    try {
      const response = await api.getAmenities(options);
      return { options, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch amenities');
    }
  }
);

export const createAmenity = createAsyncThunk(
  'amenities/createAmenity',
  async (body, { rejectWithValue }) => {
    try {
      const response = await api.createAmenity(body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create amenity');
    }
  }
);

export const updateAmenity = createAsyncThunk(
  'amenities/updateAmenity',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const response = await api.updateAmenity(id, body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update amenity');
    }
  }
);

export const deleteAmenity = createAsyncThunk(
  'amenities/deleteAmenity',
  async (id, { rejectWithValue }) => {
    try {
      await api.deleteAmenity(id);
      return { id };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete amenity');
    }
  }
);

// ─── Amenity Placements ──────────────────────────────────────────────────────
export const fetchAmenityPlacements = createAsyncThunk(
  'amenities/fetchAmenityPlacements',
  async (conversionId, { rejectWithValue }) => {
    try {
      const response = await api.getAmenityPlacements(conversionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch amenity placements');
    }
  }
);

export const createAmenityPlacement = createAsyncThunk(
  'amenities/createAmenityPlacement',
  async (body, { rejectWithValue }) => {
    try {
      const response = await api.createAmenityPlacement(body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create amenity placement');
    }
  }
);

export const updateAmenityPlacement = createAsyncThunk(
  'amenities/updateAmenityPlacement',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const response = await api.updateAmenityPlacement(id, body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update amenity placement');
    }
  }
);

export const deleteAmenityPlacement = createAsyncThunk(
  'amenities/deleteAmenityPlacement',
  async (id, { rejectWithValue }) => {
    try {
      await api.deleteAmenityPlacement(id);
      return { id };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete amenity placement');
    }
  }
);

const initialState = {
  items: [], // Master amenities
  placements: [], // Placed instances
  
  // Master Pagination
  total: 0,
  page: 1,
  limit: 100,
  totalPages: 1,
  
  loading: false,
  error: null,
};

const amenitiesSlice = createSlice({
  name: 'amenities',
  initialState,
  reducers: {
    clearAmenitiesError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Master Amenities
      .addCase(fetchAmenities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAmenities.fulfilled, (state, action) => {
        state.loading = false;
        const { options, response } = action.payload;
        if (options.pagination === false) {
          state.items = response;
        } else {
          state.items = response.data || [];
          state.total = response.meta?.total || 0;
          state.page = response.meta?.page || state.page;
          state.totalPages = response.meta?.totalPages || state.totalPages;
        }
      })
      .addCase(fetchAmenities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create Master Amenity
      .addCase(createAmenity.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })

      // Update Master Amenity
      .addCase(updateAmenity.fulfilled, (state, action) => {
        const index = state.items.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })

      // Delete Master Amenity
      .addCase(deleteAmenity.fulfilled, (state, action) => {
        state.items = state.items.filter(a => a.id !== action.payload.id);
      })

      // Fetch Placements
      .addCase(fetchAmenityPlacements.fulfilled, (state, action) => {
        state.placements = action.payload;
      })

      // Create Placement
      .addCase(createAmenityPlacement.fulfilled, (state, action) => {
        state.placements.push(action.payload);
      })

      // Update Placement
      .addCase(updateAmenityPlacement.fulfilled, (state, action) => {
        const index = state.placements.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.placements[index] = action.payload;
        }
      })

      // Delete Placement
      .addCase(deleteAmenityPlacement.fulfilled, (state, action) => {
        state.placements = state.placements.filter(p => p.id !== action.payload.id);
      });
  }
});

export const { clearAmenitiesError } = amenitiesSlice.actions;

export default amenitiesSlice.reducer;
