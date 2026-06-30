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
  MultiSelectWidget,
} from '../widgets';

export const registerDefaultWidgets = () => {
  widgetRegistry.register({ widget: 'text', component: TextInputWidget });
  widgetRegistry.register({ widget: 'textarea', component: TextAreaWidget });
  widgetRegistry.register({ widget: 'number', component: NumberInputWidget });
  widgetRegistry.register({ widget: 'boolean', component: BooleanWidget });
  widgetRegistry.register({ widget: 'date', component: DateInputWidget });
  widgetRegistry.register({ widget: 'datetime', component: DateTimeInputWidget });
  widgetRegistry.register({ widget: 'select', component: SelectWidget });
  widgetRegistry.register({ widget: 'radio', component: RadioWidget });
  widgetRegistry.register({ widget: 'checkbox', component: CheckboxWidget });
  widgetRegistry.register({ widget: 'file', component: FileInputWidget });
  widgetRegistry.register({ widget: 'table', component: TableWidget });
  widgetRegistry.register({ widget: 'dialog-table', component: DialogTableWidget });
  widgetRegistry.register({ widget: 'array-widget', component: ArrayWidget });
  widgetRegistry.register({ widget: 'iterable-accordion', component: IterableAccordionWidget });
  widgetRegistry.register({ widget: 'phone', component: PhoneInputWidget });
  widgetRegistry.register({ widget: 'currency', component: CurrencyInputWidget });
  widgetRegistry.register({ widget: 'display', component: DisplayWidget });
  widgetRegistry.register({ widget: 'profile', component: ProfileWidget });
  widgetRegistry.register({ widget: 'header-section', component: HeaderSectionWidget });
  widgetRegistry.register({ widget: 'scores-display', component: ScoresDisplayWidget });
  widgetRegistry.register({ widget: 'id-authentication', component: IdAuthenticationWidget });
  widgetRegistry.register({ widget: 'register-lookup', component: RegisterLookupWidget });
  widgetRegistry.register({ widget: 'multi-select', component: MultiSelectWidget });
};

registerDefaultWidgets();
