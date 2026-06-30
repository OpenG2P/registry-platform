import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WidgetState, WidgetValue } from '../types';

const initialState: WidgetState = {
  values: {},
  errors: {},
  touched: {},
  loading: {},
  dataSources: {},
};

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

      const recentCall = recentSetValueCalls.get(widgetId);
      const isRaceCondition = recentCall &&
        recentCall.timestamp > now - 100 &&
        recentCall.value !== value &&
        recentCall.value === previousValue;

      recentSetValueCalls.set(widgetId, { value, timestamp: now });

      for (const [key, call] of recentSetValueCalls.entries()) {
        if (now - call.timestamp > 1000) {
          recentSetValueCalls.delete(key);
        }
      }

      if (isRaceCondition) {
        return;
      }

      state.values[widgetId] = value;
      if (state.errors[widgetId]) {
        delete state.errors[widgetId];
      }
    },
    setValues: (state, action: PayloadAction<Record<string, WidgetValue>>) => {
      const merged = { ...state.values };
      for (const [key, value] of Object.entries(action.payload)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value) &&
            merged[key] !== null && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
          merged[key] = { ...merged[key], ...value };
        } else {
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
