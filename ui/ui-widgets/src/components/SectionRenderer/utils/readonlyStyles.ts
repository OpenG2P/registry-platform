export const READONLY_VALUE_ROW_ROOT_CLASSES = [
  'TextDisplayWidget',
  'TextAreaDisplayWidget',
  'SelectDisplayWidget',
  'PhoneDisplayWidget',
  'NumberDisplayWidget',
  'CurrencyDisplayWidget',
  'RadioDisplayWidget',
  'DateDisplayWidget',
  'DateTimeDisplayWidget',
  'CheckboxDisplayWidget',
  'BooleanDisplayWidget',
  'FileDisplayWidget',
  'DisplayFieldWidget',
] as const;

export const READONLY_SINGLE_LINE_VALUE_ROW_CLASSES = [
  'TextDisplayWidget',
  'SelectDisplayWidget',
  'PhoneDisplayWidget',
  'NumberDisplayWidget',
  'CurrencyDisplayWidget',
  'RadioDisplayWidget',
  'DateDisplayWidget',
  'DateTimeDisplayWidget',
  'CheckboxDisplayWidget',
  'BooleanDisplayWidget',
  'DisplayFieldWidget',
] as const;

export const scopedClassSelectors = (
  sectionClassId: string,
  classNames: readonly string[],
): string => classNames.map((c) => `.${sectionClassId} .${c}`).join(',\n        ');

export const buildReadonlyStyleSelectors = (sectionClassId: string) => ({
  readonlyValueRowRootsCss: scopedClassSelectors(
    sectionClassId,
    READONLY_VALUE_ROW_ROOT_CLASSES,
  ),
  readonlyValueRowFlex1Css: READONLY_VALUE_ROW_ROOT_CLASSES.map(
    (c) => `.${sectionClassId} .${c} > .flex-1`,
  ).join(',\n        '),
  readonlySingleLineValueTextCss: READONLY_SINGLE_LINE_VALUE_ROW_CLASSES.map(
    (c) => `.${sectionClassId} .${c} > .flex-1 > .text-gray-900`,
  ).join(',\n        '),
});
