import React, { useContext } from 'react';
import { WidgetEventBus } from '../events/WidgetEventBus';

const WidgetEventBusContext = React.createContext<WidgetEventBus | null>(null);

// Export for use in WidgetProvider
export { WidgetEventBusContext };

/**
 * Hook to access the widget event bus from context
 */
export const useWidgetEventBus = (): WidgetEventBus | null => {
  return useContext(WidgetEventBusContext);
};
