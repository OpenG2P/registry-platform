export interface SectionChanges {
  section_id?: string;
  section_register_id?: string;
  /** Non-file field values only. File widgets are never included here. */
  records: unknown[];
  /**
   * All section files (profile, supporting docs, and direct file widgets).
   * Each entry includes `tag`: `_profile` | `_supporting_docs` | `_direct_file`.
   *
   * Two shapes:
   * - Fresh upload: SerializedFile (`__type: "File"`) + meta
   * - Unchanged existing doc:
   *   `{ label, document_id, presigned_url, source_filename?, tag, field? }`
   */
  section_files?: unknown[];
}
