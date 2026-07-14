import { BaseWidgetConfig, WidgetRegistryEntry, WidgetRenderFunction } from '../types';
import React from 'react';

class WidgetRegistry {
  private widgets: Map<string, WidgetRegistryEntry> = new Map();

  register(entry: WidgetRegistryEntry): void {
    this.widgets.set(entry.widget, entry);
  }

  registerMany(entries: WidgetRegistryEntry[]): void {
    entries.forEach((entry) => this.register(entry));
  }

  get(widgetName: string): WidgetRegistryEntry | undefined {
    return this.widgets.get(widgetName);
  }

  has(widgetName: string): boolean {
    return this.widgets.has(widgetName);
  }

  getAll(): WidgetRegistryEntry[] {
    return Array.from(this.widgets.values());
  }

  unregister(widgetName: string): boolean {
    return this.widgets.delete(widgetName);
  }

  clear(): void {
    this.widgets.clear();
  }

  render(
    config: BaseWidgetConfig,
    context: any,
    defaultComponent?: React.ComponentType<any>
  ): React.ReactNode {
    const entry = this.get(config.widget);
    if (!entry) {
      if (defaultComponent) {
        return React.createElement(defaultComponent, { config, ...context });
      }
      console.warn(`Widget "${config.widget}" is not registered`);
      return null;
    }

    if (typeof entry.component === 'function') {
      if (entry.component.length > 1) {
        return (entry.component as WidgetRenderFunction)(config, context);
      }
      return React.createElement(entry.component as React.ComponentType<any>, {
        config,
        ...context,
        ...entry.defaultProps,
      });
    }

    return React.createElement(entry.component, {
      config,
      ...context,
      ...entry.defaultProps,
    });
  }
}

export const widgetRegistry = new WidgetRegistry();
