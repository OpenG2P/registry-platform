/**
 * Widget Event Bus
 * Provides a publish/subscribe mechanism for widget communication
 * Supports debounce and throttle for performance optimization
 */

export type WidgetEventType =
  | 'widget:change'
  | 'widget:blur'
  | 'widget:focus'
  | 'widget:reload'
  | 'widget:clear';

export interface WidgetEvent {
  type: WidgetEventType;
  widgetId: string;
  value?: any;
  timestamp: number;
}

type EventHandler = (event: WidgetEvent) => void | Promise<void>;

interface Subscription {
  handler: EventHandler;
  debounce?: number;
  throttle?: number;
  lastCallTime?: number;
  debounceTimer?: ReturnType<typeof setTimeout>;
}

export class WidgetEventBus {
  private subscriptions: Map<WidgetEventType, Map<string, Subscription[]>> = new Map();
  private throttleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Subscribe to an event type
   * @param eventType The type of event to listen to
   * @param handler The handler function
   * @param options Debounce/throttle options
   * @returns Unsubscribe function
   */
  subscribe(
    eventType: WidgetEventType,
    handler: EventHandler,
    options?: { debounce?: number; throttle?: number }
  ): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Map());
    }

    const eventSubscriptions = this.subscriptions.get(eventType)!;
    const subscriptionId = `${Date.now()}-${Math.random()}`;
    const subscription: Subscription = {
      handler,
      debounce: options?.debounce,
      throttle: options?.throttle,
    };

    if (!eventSubscriptions.has(subscriptionId)) {
      eventSubscriptions.set(subscriptionId, []);
    }
    eventSubscriptions.get(subscriptionId)!.push(subscription);

    // Return unsubscribe function
    return () => {
      const subs = eventSubscriptions.get(subscriptionId);
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index > -1) {
          subs.splice(index, 1);
          if (subs.length === 0) {
            eventSubscriptions.delete(subscriptionId);
          }
        }
      }
    };
  }

  /**
   * Publish an event
   * @param event The event to publish
   */
  publish(event: WidgetEvent): void {
    const eventSubscriptions = this.subscriptions.get(event.type);
    if (!eventSubscriptions) {
      return;
    }

    eventSubscriptions.forEach((subscriptions) => {
      subscriptions.forEach((subscription) => {
        this.executeHandler(subscription, event);
      });
    });
  }

  /**
   * Execute handler with debounce/throttle support
   */
  private executeHandler(subscription: Subscription, event: WidgetEvent): void {
    const { handler, debounce, throttle } = subscription;

    // Clear existing debounce timer if any
    if (subscription.debounceTimer) {
      clearTimeout(subscription.debounceTimer);
    }

    // Handle throttle
    if (throttle && throttle > 0) {
      const throttleKey = `${event.type}-${event.widgetId}`;
      const now = Date.now();
      const lastCallTime = subscription.lastCallTime || 0;

      if (now - lastCallTime < throttle) {
        // Still in throttle period, schedule for later
        if (this.throttleTimers.has(throttleKey)) {
          return; // Already scheduled
        }

        const remainingTime = throttle - (now - lastCallTime);
        const timer = setTimeout(() => {
          subscription.lastCallTime = Date.now();
          handler(event);
          this.throttleTimers.delete(throttleKey);
        }, remainingTime);

        this.throttleTimers.set(throttleKey, timer);
        return;
      }

      subscription.lastCallTime = now;
    }

    // Handle debounce
    if (debounce && debounce > 0) {
      subscription.debounceTimer = setTimeout(() => {
        handler(event);
        subscription.debounceTimer = undefined;
      }, debounce);
      return;
    }

    // Execute immediately if no debounce/throttle
    handler(event);
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    // Clear all timers
    this.subscriptions.forEach((eventSubscriptions) => {
      eventSubscriptions.forEach((subscriptions) => {
        subscriptions.forEach((sub) => {
          if (sub.debounceTimer) {
            clearTimeout(sub.debounceTimer);
          }
        });
      });
    });

    this.throttleTimers.forEach((timer) => clearTimeout(timer));
    this.throttleTimers.clear();
    this.subscriptions.clear();
  }
}
