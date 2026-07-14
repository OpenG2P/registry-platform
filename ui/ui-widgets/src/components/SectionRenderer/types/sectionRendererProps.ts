import { UseBaseWidgetOptions } from '../../../hooks/useBaseWidget';
import { SectionConfig } from '../../../types';
import { SectionMode } from '../../SectionsContainer';
import { SectionChanges } from './sectionChanges';

export interface SectionRendererProps {
  section: SectionConfig;
  dataSourceRequestHandler?: UseBaseWidgetOptions['dataSourceRequestHandler'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  gridColumnSpan?: number;
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
  hideEditButton?: boolean;
  mode?: SectionMode;
  changeRequestType?: 'new' | 'old';
  showChangeRequestLabel?: boolean;
  dbSectionId?: string;
  sectionRegisterId?: string;
  onSectionDirtyChange?: (sectionId: string, isDirty: boolean) => void;
  sectionIndex?: number;
  sectionCount?: number;
  expandedSectionIndex?: number | null;
  onExpandSection?: (index: number) => void;
  onSectionSaveSuccess?: (index: number) => void;
  onPreviousSection?: (index: number) => void;
  isDraft?: boolean;
  isAccessible?: boolean;
  onEditModeChange?: (sectionId: string, editing: boolean) => void;
  forceExitEdit?: boolean;
}
