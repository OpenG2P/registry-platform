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
          // Ignore these action types - File objects should be serialized before reaching Redux
          // The FileInputWidget handles serialization before dispatching
          ignoredActions: ['widget/setValue', 'widget/setValues', 'widget/setError'],
          // Also ignore the values path to prevent warnings for serialized file structures
          ignoredPaths: ['widget.values'],
        },
      }),
  });
};

export type WidgetStore = ReturnType<typeof createWidgetStore>;
export type WidgetRootState = ReturnType<WidgetStore['getState']>;
export type WidgetDispatch = WidgetStore['dispatch'];

