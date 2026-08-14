import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@/lib/api';

// Thunks
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getCadProjects();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch projects');
    }
  }
);

export const fetchPublicProjects = createAsyncThunk(
  'projects/fetchPublicProjects',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getPublicProjects();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch public projects');
    }
  }
);

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.getCadProject(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch project');
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (body, { rejectWithValue }) => {
    try {
      const response = await api.createCadProject(body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create project');
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const response = await api.updateCadProject(id, body);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update project');
    }
  }
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.deleteCadProject(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete project');
    }
  }
);

const initialState = {
  items: [],
  selectedProject: null,
  loading: false,
  error: null,
  
  // Specific loading states for fine-grained UI
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearProjectError: (state) => {
      state.error = null;
    },
    clearSelectedProject: (state) => {
      state.selectedProject = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Projects
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Public Projects
      .addCase(fetchPublicProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPublicProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Project By Id
      .addCase(fetchProjectById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedProject = action.payload;
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create Project
      .addCase(createProject.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.isCreating = false;
        // Optionally append to list
        state.items.push(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })

      // Update Project
      .addCase(updateProject.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.selectedProject?.id === action.payload.id) {
          state.selectedProject = action.payload;
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })

      // Delete Project
      .addCase(deleteProject.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.items = state.items.filter(p => p.id !== action.payload.id);
        if (state.selectedProject?.id === action.payload.id) {
          state.selectedProject = null;
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  }
});

export const { clearProjectError, clearSelectedProject } = projectsSlice.actions;

export default projectsSlice.reducer;
