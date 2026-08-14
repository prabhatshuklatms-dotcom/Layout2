import { configureStore } from '@reduxjs/toolkit';
import projectReducer from './slices/projectsSlice';
import conversionsReducer from './slices/conversionsSlice';
import plotsReducer from './slices/plotsSlice';
import amenitiesReducer from './slices/amenitiesSlice';
import plotStatusesReducer from './slices/plotStatusesSlice';
import appearanceReducer from './slices/appearanceSlice';

export const store = configureStore({
  reducer: {
    projects: projectReducer,
    conversions: conversionsReducer,
    plots: plotsReducer,
    amenities: amenitiesReducer,
    plotStatuses: plotStatusesReducer,
    appearance: appearanceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Useful for large nested JSON or file data sometimes
    }),
});
