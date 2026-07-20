import React, { useContext } from 'react';
import { WidgetEventBus } from '../events/WidgetEventBus';

const WidgetEventBusContext = React.createContext<WidgetEventBus | null>(null);

export { WidgetEventBusContext };

export const useWidgetEventBus = (): WidgetEventBus | null => {
  return useContext(WidgetEventBusContext);
};
