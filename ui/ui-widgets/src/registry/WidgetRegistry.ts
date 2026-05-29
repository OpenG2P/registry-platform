import { BaseWidgetConfig, WidgetRegistryEntry, WidgetRenderFunction } from '../types';
import React from 'react';

class WidgetRegistry {
  private widgets: Map<string, WidgetRegistryEntry> = new Map();

  /**
   * Register a widget
   */
  register(entry: WidgetRegistryEntry): void {
    this.widgets.set(entry.widget, entry);
  }

  /**
   * Register multiple widgets
   */
  registerMany(entries: WidgetRegistryEntry[]): void {
    entries.forEach((entry) => this.register(entry));
  }

  /**
   * Get widget entry
   */
  get(widgetName: string): WidgetRegistryEntry | undefined {
    return this.widgets.get(widgetName);
  }

  /**
   * Check if widget is registered
   */
  has(widgetName: string): boolean {
    return this.widgets.has(widgetName);
  }

  /**
   * Get all registered widgets
   */
  getAll(): WidgetRegistryEntry[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Unregister a widget
   */
  unregister(widgetName: string): boolean {
    return this.widgets.delete(widgetName);
  }

  /**
   * Clear all widgets
   */
  clear(): void {
    this.widgets.clear();
  }

  /**
   * Render widget component
   */
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
      // Check if it's a render function
      if (entry.component.length > 1) {
        return (entry.component as WidgetRenderFunction)(config, context);
      }
      // Regular component
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

// Singleton instance
export const widgetRegistry = new WidgetRegistry();

