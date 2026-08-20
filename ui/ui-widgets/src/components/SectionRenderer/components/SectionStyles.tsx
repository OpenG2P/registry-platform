export interface SectionStylesProps {
  sectionClassId: string;
  gridId: string;
  columnSpan: number;
  hasTableWidget: boolean;
  readonlyValueRowRootsCss: string;
  readonlyValueRowFlex1Css: string;
  readonlySingleLineValueTextCss: string;
}

export const SectionStyles = ({
  sectionClassId,
  gridId,
  columnSpan,
  hasTableWidget,
  readonlyValueRowRootsCss,
  readonlyValueRowFlex1Css,
  readonlySingleLineValueTextCss,
}: SectionStylesProps) => (
  <style>{`
    .${sectionClassId} {
      width: 100%;
      position: relative;
      transition: box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out;
      min-height: auto !important;
      height: auto !important;
    }
    .${sectionClassId} label.text-gray-700,
    .${sectionClassId} .text-gray-600 {
      font-weight: 400 !important;
      color: var(--owt-color-text-muted, #727474) !important;
      width: 50% !important;
      min-width: 50% !important;
      max-width: 50% !important;
      flex-shrink: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    ${readonlyValueRowRootsCss} {
      min-width: 0 !important;
      overflow: hidden !important;
    }
    ${readonlyValueRowFlex1Css} {
      min-width: 0 !important;
      overflow: hidden !important;
    }
    ${readonlySingleLineValueTextCss} {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${sectionClassId} .TextAreaDisplayWidget > .flex-1 > pre {
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .${sectionClassId}[data-edit-mode="true"] {
      min-height: auto;
    }
    .${sectionClassId}[data-edit-mode="true"] {
      visibility: hidden;
      position: relative;
    }
    .${sectionClassId}[data-edit-mode="true"] * {
      visibility: hidden;
    }
    .${sectionClassId}-edit {
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2),
                  0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border-color: var(--owt-color-primary-dark, #F07B1A);
      border-style: dashed;
      border-width: 1px;
      background-color: var(--owt-color-primary-light, #FBE6AA);
      border-radius: var(--owt-section-border-radius, 10px);
      z-index: 10;
      position: absolute;
    }
    .${sectionClassId}-edit .widget-container {
      margin-bottom: 0 !important;
    }
    .${sectionClassId}[data-has-explicit-span="false"] {
      grid-column: span ${columnSpan};
    }
    #${gridId} {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      ${hasTableWidget ? 'margin-bottom: 20px;' : ''}
    }
    #${gridId} > .panel-wrapper {
      flex: 1 1 100%;
      min-width: 0;
      position: relative;
    }
    #${gridId} > hr,
    #${gridId} > .registry-edit-details {
      flex: 0 0 100%;
      width: 100%;
      max-width: 100%;
    }
    @media (min-width: 640px) {
      #${gridId} > .panel-wrapper {
        flex: 1 1 calc(50% - 0.75rem);
      }
    }
    @media (min-width: 1024px) {
      #${gridId} > .panel-wrapper {
        flex: 1 1 calc(33.333% - 1rem);
      }
    }
    @media (min-width: 1280px) {
      #${gridId} > .panel-wrapper {
        flex: 1 1 calc(25% - 1.125rem);
      }
    }
    @media (min-width: 1536px) {
      #${gridId} > .panel-wrapper {
        flex: 1 1 calc(20% - 1.2rem);
      }
    }
    .${sectionClassId} .supporting-documents-container {
      width: 100%;
    }
    .${sectionClassId} .supporting-documents-title-button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
    }
    .${sectionClassId} .supporting-documents-title-button:hover {
      opacity: 0.8;
    }
    .${sectionClassId} .supporting-documents-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .${sectionClassId} .supporting-document-item {
      width: 100%;
    }
    .${sectionClassId} .supporting-document-item > div {
      margin-bottom: 0 !important;
    }
    .${sectionClassId} .edit-controls-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
    }
    .${sectionClassId} .edit-controls-buttons {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 0.5rem;
    }
    .${sectionClassId}.intake-form-accordion-item {
      border-color: var(--owt-color-border-light, #E4E4E4);
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .${sectionClassId}.intake-form-accordion-item:hover {
      border-color: var(--owt-color-border, #C4C4C4);
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-accordion-header {
      transition: opacity 0.2s ease, background-color 0.2s ease;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-accordion-header h2 {
      color: var(--owt-color-primary-dark, #F07B1A);
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-accordion-header[data-interactive="true"]:hover {
      opacity: 0.85;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-accordion-header[data-interactive="true"]:focus-visible {
      outline: 2px solid var(--owt-color-primary, #F5BB1A);
      outline-offset: 2px;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-accordion-header[data-interactive="false"]:focus-visible {
      outline: none;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-accordion-content {
      padding-top: 8px;
      padding-bottom: 0px;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-edit-controls {
      justify-content: flex-end;
      width: 100%;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-prev-btn {
      color: var(--owt-color-text-muted, #727474) !important;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-prev-btn:disabled {
      color: var(--owt-color-border, #C4C4C4) !important;
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-prev-btn:hover:not(:disabled) {
      background-color: var(--owt-color-bg-alt, #F6F6F6);
      border-color: var(--owt-btn-primary-border, #F07B1A);
    }
    .${sectionClassId}.intake-form-accordion-item .intake-form-save-btn:hover:not(:disabled) {
      background-color: var(--owt-color-border-light, #E4E4E4);
    }
  `}</style>
);
