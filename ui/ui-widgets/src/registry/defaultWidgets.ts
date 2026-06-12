import { widgetRegistry } from './WidgetRegistry';
import {
  TextInputWidget,
  NumberInputWidget,
  BooleanWidget,
  DateInputWidget,
  DateTimeInputWidget,
  SelectWidget,
  RadioWidget,
  CheckboxWidget,
  FileInputWidget,
  SimpleTableWidget,
  ArrayWidget,
  IterableAccordionWidget,
  PhoneInputWidget,
  CurrencyInputWidget,
  DisplayWidget,
  TableWidget,
  DialogTableWidget,
  ProfileWidget,
  TextAreaWidget,
  HeaderSectionWidget,
  ScoresDisplayWidget,
  IdAuthenticationWidget,
  RegisterLookupWidget,
} from '../widgets';

/**
 * Register all default/generic widgets
 * This is called automatically when the package is imported
 */
export const registerDefaultWidgets = () => {
  // Text input widget (supports all text-based inputs via configuration: text, email, tel, number, etc.)
  widgetRegistry.register({ widget: 'text', component: TextInputWidget });

  // TextArea widget (multi-line text input with 2 rows by default)
  widgetRegistry.register({ widget: 'textarea', component: TextAreaWidget });

  // Number input widget (specialized for numeric input with formatting, precision, and validation)
  widgetRegistry.register({ widget: 'number', component: NumberInputWidget });

  // Boolean widget (supports checkbox, radio, toggle with custom representations)
  widgetRegistry.register({ widget: 'boolean', component: BooleanWidget });

  // Date input widget
  widgetRegistry.register({ widget: 'date', component: DateInputWidget });

  // DateTime input widget
  widgetRegistry.register({ widget: 'datetime', component: DateTimeInputWidget });

  // Select/Dropdown widget
  widgetRegistry.register({ widget: 'select', component: SelectWidget });

  // Radio button widget
  widgetRegistry.register({ widget: 'radio', component: RadioWidget });

  // Checkbox widget (supports single or multiple checkboxes)
  widgetRegistry.register({ widget: 'checkbox', component: CheckboxWidget });

  // File input widget
  widgetRegistry.register({ widget: 'file', component: FileInputWidget });

  // Table widget
  widgetRegistry.register({ widget: 'simple-table', component: SimpleTableWidget });

  // Table widget with record-level editing
  widgetRegistry.register({ widget: 'table', component: TableWidget });

  // Table widget with add/edit popup dialog
  widgetRegistry.register({ widget: 'dialog-table', component: DialogTableWidget });

  // Group widgets
  widgetRegistry.register({ widget: 'array-widget', component: ArrayWidget });
  widgetRegistry.register({ widget: 'iterable-accordion', component: IterableAccordionWidget });
  // Phone and Currency Widgets
  widgetRegistry.register({ widget: 'phone', component: PhoneInputWidget });
  widgetRegistry.register({ widget: 'currency', component: CurrencyInputWidget });

  // Display widget for readonly text display
  widgetRegistry.register({ widget: 'display', component: DisplayWidget });

  // Profile widget for displaying user identity (image, name, ID)
  widgetRegistry.register({ widget: 'profile', component: ProfileWidget });

  // Header section widget for full-width registry header with profile, status, and metadata
  widgetRegistry.register({ widget: 'header-section', component: HeaderSectionWidget });

  // Scores display widget for full-width computed scores display (view-only)
  widgetRegistry.register({ widget: 'scores-display', component: ScoresDisplayWidget });

  // ID Authentication widget for OIDC-based foundational ID authentication (view-only + action)
  widgetRegistry.register({ widget: 'id-authentication', component: IdAuthenticationWidget });

  // Register lookup widget — searchable popup to select a record from any register
  widgetRegistry.register({ widget: 'register-lookup', component: RegisterLookupWidget });
};

// Auto-register on import
registerDefaultWidgets();
// Debug: Verify number widget is registered (browser only)
if (typeof window !== 'undefined') {
  // Only log in browser environment
  if (!widgetRegistry.has('number')) {
    console.error('NumberInputWidget was not registered! Available widgets:', 
      Array.from(widgetRegistry.getAll().map((w: { widget: string }) => w.widget)));
  }
}

