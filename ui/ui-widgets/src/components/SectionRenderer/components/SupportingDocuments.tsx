import { SupportingDocumentConfig } from '../../../types';
import { FileInputWidget } from '../../../widgets/FileInputWidget';
import { SectionMode } from '../../SectionsContainer';
import { createDocumentWidgetConfig } from '../utils/documentWidgetConfig';
import { arrowUpIcon, arrowDownIcon } from '../../../assets';
import { useWidgetContext } from '../../WidgetProvider';

export interface SupportingDocumentsProps {
  sectionId: string;
  documents: SupportingDocumentConfig[];
  mode: SectionMode;
  isDraft?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  collapsible?: boolean;
}

export const SupportingDocuments = ({
  sectionId,
  documents,
  mode,
  isDraft,
  expanded = true,
  onToggleExpanded,
  collapsible = false,
}: SupportingDocumentsProps) => {
  const { t } = useWidgetContext();

  if (documents.length === 0) return null;

  const title = t?.('common.supportedDocuments') || 'Supported Documents';

  return (
    <div className="supporting-documents-container">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="supporting-documents-title-button w-full flex items-center text-left"
        >
          <span className="font-semibold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}>
            {title}
          </span>
          <img
            src={expanded ? arrowUpIcon : arrowDownIcon}
            alt="Toggle Documents"
            className="w-4 h-2.25 transition-transform ml-2"
          />
        </button>
      ) : (
        <span className="font-semibold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}>
          {title}
        </span>
      )}
      {expanded && (
        <div className="supporting-documents-grid mt-4">
          {documents.map((doc, index) => {
            const docConfig = createDocumentWidgetConfig(doc, sectionId, index, mode, isDraft);
            return (
              <div key={`${sectionId}-doc-${index}`} className="supporting-document-item">
                <FileInputWidget config={docConfig} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
