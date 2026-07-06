import { SupportingDocumentConfig } from '../../../types';
import { SectionMode } from '../../SectionsContainer';

export const createDocumentWidgetConfig = (
  doc: SupportingDocumentConfig,
  sectionId: string,
  index: number,
  mode: SectionMode,
  isDraft?: boolean,
) => {
  const documentType = doc['document-type'] || 'file';
  const accept =
    doc['document-accept'] ||
    (documentType === 'image'
      ? 'image/*'
      : documentType === 'pdf'
        ? '.pdf'
        : '*/*');

  const widgetId = `supporting-doc-${sectionId}-${index}`;

  return {
    widget: 'file',
    'widget-type': 'input' as const,
    'widget-label':
      doc['document-label'] || doc['document-data-path'] || `Document ${index + 1}`,
    'widget-id': widgetId,
    'widget-data-path': doc['document-data-path'],
    'widget-required': doc['document-required'] || false,
    'widget-readonly': mode === 'IntakeForm' && isDraft === false,
    'widget-data-options': {
      accept,
      multiple: false,
      maxSize: doc['document-max-size'],
    },
  };
};
