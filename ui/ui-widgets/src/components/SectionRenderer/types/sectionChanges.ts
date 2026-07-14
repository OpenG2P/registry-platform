export interface SectionChanges {
  section_id?: string;
  section_register_id?: string;
  records: unknown[];
  files?: unknown[];
  image?: File | null;
}
