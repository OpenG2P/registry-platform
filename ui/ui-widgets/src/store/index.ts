import { configureStore } from '@reduxjs/toolkit';
import widgetReducer from './widgetSlice';

export const createWidgetStore = () => {
  return configureStore({
    reducer: {
      widget: widgetReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['widget/setValue', 'widget/setValues', 'widget/setError'],
          ignoredPaths: ['widget.values'],
        },
      }),
  });
};

export type WidgetStore = ReturnType<typeof createWidgetStore>;
export type WidgetRootState = ReturnType<WidgetStore['getState']>;
export type WidgetDispatch = WidgetStore['dispatch'];

