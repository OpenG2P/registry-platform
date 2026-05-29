import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WidgetState, WidgetValue } from '../types';

const initialState: WidgetState = {
  values: {},
  errors: {},
  touched: {},
  loading: {},
  dataSources: {},
};

// Track recent setValue calls to detect race conditions
const recentSetValueCalls = new Map<string, { value: any; timestamp: number }>();

const widgetSlice = createSlice({
  name: 'widget',
  initialState,
  reducers: {
    setValue: (
      state,
      action: PayloadAction<{ widgetId: string; value: WidgetValue }>
    ) => {
      const { widgetId, value } = action.payload;
      const previousValue = state.values[widgetId];
      const now = Date.now();
      
      // Check if we recently set a different value (race condition detection)
      const recentCall = recentSetValueCalls.get(widgetId);
      const isRaceCondition = recentCall && 
        recentCall.timestamp > now - 100 && // Within 100ms
        recentCall.value !== value && 
        recentCall.value === previousValue; // Trying to set back to old value
      
      // Track this call
      recentSetValueCalls.set(widgetId, { value, timestamp: now });
      
      // Clean up old entries (older than 1 second)
      for (const [key, call] of recentSetValueCalls.entries()) {
        if (now - call.timestamp > 1000) {
          recentSetValueCalls.delete(key);
        }
      }
      
      // CRITICAL: Prevent race condition - if we just set a new value, don't allow setting the old value back
      if (isRaceCondition) {
        return; // Don't update the value
      }
      
      state.values[widgetId] = value;
      // Clear errors when value changes
      if (state.errors[widgetId]) {
        delete state.errors[widgetId];
      }
    },
    setValues: (state, action: PayloadAction<Record<string, WidgetValue>>) => {
      // setWidgetValue returns the complete updated state object with all keys preserved
      // We need to do a deep merge to preserve nested structures that aren't in the payload
      // But since setWidgetValue already includes all existing data, we can merge at top level
      // However, we need to be careful: if payload has nested objects, we need to deep merge them
      const merged = { ...state.values };
      for (const [key, value] of Object.entries(action.payload)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value) &&
            merged[key] !== null && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
          // Deep merge nested objects to preserve properties not in the payload
          merged[key] = { ...merged[key], ...value };
        } else {
          // Replace primitives, arrays, or null values, or if target is not an object
          merged[key] = value;
        }
      }
      state.values = merged;
    },
    setError: (
      state,
      action: PayloadAction<{ widgetId: string; errors: string[] }>
    ) => {
      if (action.payload.errors.length > 0) {
        state.errors[action.payload.widgetId] = action.payload.errors;
      } else {
        delete state.errors[action.payload.widgetId];
      }
    },
    setTouched: (
      state,
      action: PayloadAction<{ widgetId: string; touched: boolean }>
    ) => {
      state.touched[action.payload.widgetId] = action.payload.touched;
    },
    setLoading: (
      state,
      action: PayloadAction<{ widgetId: string; loading: boolean }>
    ) => {
      state.loading[action.payload.widgetId] = action.payload.loading;
    },
    setDataSource: (
      state,
      action: PayloadAction<{ widgetId: string; data: any[] }>
    ) => {
      state.dataSources[action.payload.widgetId] = action.payload.data;
    },
    resetWidget: (state, action: PayloadAction<string>) => {
      const widgetId = action.payload;
      delete state.values[widgetId];
      delete state.errors[widgetId];
      delete state.touched[widgetId];
      delete state.loading[widgetId];
      delete state.dataSources[widgetId];
    },
    resetAll: () => initialState,
  },
});

export const {
  setValue,
  setValues,
  setError,
  setTouched,
  setLoading,
  setDataSource,
  resetWidget,
  resetAll,
} = widgetSlice.actions;

export default widgetSlice.reducer;

