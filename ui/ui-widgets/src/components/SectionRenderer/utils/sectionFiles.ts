import { BaseWidgetConfig, SectionConfig } from '../../../types';
import { getValueByPath } from '../../../utils/pathUtils';
import { collectWidgets } from '../../../utils/sectionValidate';
import {
  isSerializedFile,
  serializeFile,
  SerializedFile,
} from '../../../utils/fileSerialization';
import {
  isStoredDocumentRef,
  StoredDocumentRef,
} from '../../../utils/storedDocument';

/** Origin tags attached to entries in `SectionChanges.section_files`. */
export const SECTION_FILE_TAG = {
  PROFILE: '_profile',
  SUPPORTING_DOCS: '_supporting_docs',
  DIRECT_FILE: '_direct_file',
} as const;

export type SectionFileTag =
  (typeof SECTION_FILE_TAG)[keyof typeof SECTION_FILE_TAG];

export type SectionFileMeta = {
  tag: SectionFileTag;
  label?: string;
  field?: string;
  document_key?: string;
};

/** Fresh upload blob destined for upload APIs. */
export type SectionFileUploadEntry = SerializedFile & SectionFileMeta;

/** Existing document kept as-is when the file widget did not change. */
export type SectionFileStoredEntry = StoredDocumentRef & SectionFileMeta;

export type SectionFileEntry = SectionFileUploadEntry | SectionFileStoredEntry;

type RawSectionFile = SectionFileMeta & {
  value: File | SerializedFile | StoredDocumentRef;
};

const fieldFromPath = (path: string): string =>
  path.includes('.') ? path.split('.').slice(1).join('.') : path;

const isFreshUpload = (value: unknown): value is File | SerializedFile =>
  (typeof File !== 'undefined' && value instanceof File) || isSerializedFile(value);

const isCollectableFileValue = (
  value: unknown,
): value is File | SerializedFile | StoredDocumentRef =>
  isFreshUpload(value) || isStoredDocumentRef(value);

export const isFreshSectionFileEntry = (
  entry: SectionFileEntry,
): entry is SectionFileUploadEntry => isSerializedFile(entry);

export const getProfileImageUrlPaths = (panels: SectionConfig['panels']): string[] => {
  const paths: string[] = [];
  collectWidgets(panels)
    .filter((widget) => widget.widget === 'header-section')
    .forEach((widget) => {
      const widgetPath = widget['widget-data-path'];
      if (!widgetPath || typeof widgetPath !== 'object' || Array.isArray(widgetPath)) return;
      const imageUrlPath = (widgetPath as Record<string, string>).imageUrl;
      if (imageUrlPath) paths.push(imageUrlPath);
    });
  return paths;
};

const collectProfileFiles = (
  widgets: BaseWidgetConfig[],
  sourceData: Record<string, unknown>,
): RawSectionFile[] => {
  const files: RawSectionFile[] = [];

  for (const widget of widgets) {
    if (widget.widget !== 'header-section') continue;
    const widgetPath = widget['widget-data-path'];
    if (!widgetPath || typeof widgetPath !== 'object' || Array.isArray(widgetPath)) continue;

    const paths = widgetPath as Record<string, string>;
    if (!paths.imageUrl) continue;

    const value = getValueByPath(sourceData, paths.imageUrl);
    if (!isCollectableFileValue(value)) continue;

    const field = paths.image ? fieldFromPath(paths.image) : 'record_image_document_id';
    files.push({
      value,
      tag: SECTION_FILE_TAG.PROFILE,
      field,
      label: isStoredDocumentRef(value) ? value.label : 'profile image',
    });
  }

  return files;
};

const collectSupportingDocFiles = (
  section: SectionConfig,
  sourceData: Record<string, unknown>,
  skipPaths: Set<string>,
): RawSectionFile[] => {
  const files: RawSectionFile[] = [];
  const supportingDocuments = section['section-supporting-documents'] || [];

  for (const doc of supportingDocuments) {
    const path = doc['document-data-path'];
    if (!path || skipPaths.has(path)) continue;

    const value = getValueByPath(sourceData, path);
    if (!isCollectableFileValue(value)) continue;

    files.push({
      value,
      tag: SECTION_FILE_TAG.SUPPORTING_DOCS,
      field: fieldFromPath(path),
      label:
        (isStoredDocumentRef(value) ? value.label : undefined) ||
        doc['document-label'] ||
        fieldFromPath(path),
    });
  }

  return files;
};

const collectDirectFileWidgetFiles = (
  widgets: BaseWidgetConfig[],
  sourceData: Record<string, unknown>,
  skipPaths: Set<string>,
): RawSectionFile[] => {
  const files: RawSectionFile[] = [];

  for (const widget of widgets) {
    if (widget.widget !== 'file') continue;

    const widgetId = widget['widget-id'] || '';
    // Supporting-doc slots are collected via section-supporting-documents.
    if (widgetId.startsWith('supporting-doc-')) continue;

    const widgetPath = widget['widget-data-path'];
    if (!widgetPath || typeof widgetPath !== 'string' || skipPaths.has(widgetPath)) continue;

    const value = getValueByPath(sourceData, widgetPath);
    if (!isCollectableFileValue(value)) continue;

    const field = fieldFromPath(widgetPath);
    files.push({
      value,
      tag: SECTION_FILE_TAG.DIRECT_FILE,
      field,
      label:
        (isStoredDocumentRef(value) ? value.label : undefined) ||
        widget['widget-label'] ||
        field,
    });
  }

  return files;
};

export type CollectSectionFilesOptions = {
  /** When false, skip section-supporting-documents slots (e.g. IntakeForm). Default true. */
  includeSupportingDocuments?: boolean;
};

/**
 * Sync collection for dirty checks / snapshots.
 * Fresh uploads and existing stored document refs are returned with origin tags.
 */
export const collectAllSectionFilesSync = (
  section: SectionConfig,
  sourceData: Record<string, unknown>,
  options?: CollectSectionFilesOptions,
): RawSectionFile[] => {
  const widgets = collectWidgets(section.panels);
  const profilePaths = getProfileImageUrlPaths(section.panels);
  const skipPaths = new Set(profilePaths);
  const includeSupportingDocuments = options?.includeSupportingDocuments !== false;

  return [
    ...collectProfileFiles(widgets, sourceData),
    ...(includeSupportingDocuments
      ? collectSupportingDocFiles(section, sourceData, skipPaths)
      : []),
    ...collectDirectFileWidgetFiles(widgets, sourceData, skipPaths),
  ];
};

/** Fingerprint for dirty comparison (avoids File / base64 noise). */
export const fingerprintSectionFiles = (files: RawSectionFile[]): unknown[] =>
  files.map(({ value, tag, field, label }) => {
    if (isStoredDocumentRef(value)) {
      return {
        tag,
        field,
        label,
        document_id: value.document_id,
        source_filename: value.source_filename,
        presigned_url: value.presigned_url,
      };
    }

    return {
      tag,
      field,
      label,
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    };
  });

/**
 * Collect every section file into `section_files`:
 * - fresh uploads as serialized File blobs (`__type: "File"`)
 * - unchanged existing docs as `{ label, document_id, presigned_url, source_filename }`
 */
export const collectAllSectionFiles = async (
  section: SectionConfig,
  sourceData: Record<string, unknown>,
  options?: CollectSectionFilesOptions,
): Promise<SectionFileEntry[]> => {
  const rawFiles = collectAllSectionFilesSync(section, sourceData, options);
  const result: SectionFileEntry[] = [];

  for (const raw of rawFiles) {
    if (isStoredDocumentRef(raw.value)) {
      result.push({
        label: raw.value.label,
        document_id: raw.value.document_id,
        presigned_url: raw.value.presigned_url,
        ...(raw.value.source_filename
          ? { source_filename: raw.value.source_filename }
          : {}),
        tag: raw.tag,
        ...(raw.field ? { field: raw.field } : {}),
        ...(raw.document_key ? { document_key: raw.document_key } : {}),
      });
      continue;
    }

    const serialized =
      raw.value instanceof File ? await serializeFile(raw.value) : raw.value;
    result.push({
      ...serialized,
      tag: raw.tag,
      ...(raw.label ? { label: raw.label } : {}),
      ...(raw.field ? { field: raw.field } : {}),
      ...(raw.document_key ? { document_key: raw.document_key } : {}),
    });
  }

  return result;
};

/** Paths for file widgets / supporting docs — values travel in `section_files`, not `records`. */
export const getSectionFileBlobPaths = (
  section: SectionConfig,
  options?: CollectSectionFilesOptions,
): string[] => {
  const paths = [...getProfileImageUrlPaths(section.panels)];
  const includeSupportingDocuments = options?.includeSupportingDocuments !== false;

  collectWidgets(section.panels).forEach((widget) => {
    if (widget.widget !== 'file') return;
    const widgetId = widget['widget-id'] || '';
    if (widgetId.startsWith('supporting-doc-')) return;
    const widgetPath = widget['widget-data-path'];
    if (typeof widgetPath === 'string' && widgetPath.length > 0) {
      paths.push(widgetPath);
    }
  });

  if (includeSupportingDocuments) {
    (section['section-supporting-documents'] || []).forEach((doc) => {
      const path = doc['document-data-path'];
      if (path) paths.push(path);
    });
  }

  return paths;
};

/**
 * Remove file-widget fields from records (fresh uploads, stored docs, empty placeholders).
 * Those values are carried only in `section_files`.
 */
export const stripSectionFileBlobs = (
  records: unknown[],
  blobPaths: string[],
): unknown[] => {
  if (blobPaths.length === 0) return records;
  const fieldKeys = blobPaths.map(fieldFromPath);

  return records.map((record) => {
    if (typeof record !== 'object' || record === null) return record;
    const copy = { ...(record as Record<string, unknown>) };
    for (const key of fieldKeys) {
      if (!Object.prototype.hasOwnProperty.call(copy, key)) continue;
      delete copy[key];
    }
    return copy;
  });
};
