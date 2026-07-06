import { useState, useCallback } from 'react';
import { SectionMode } from '../../SectionsContainer';

export const useIntakeFormAccordion = (
  mode: SectionMode,
  sectionIndex?: number,
  expandedSectionIndex?: number | null,
  isAccessible = false,
  onExpandSection?: (index: number) => void,
) => {
  const [standaloneExpanded, setStandaloneExpanded] = useState(true);

  const isExpandedFromContainer =
    typeof sectionIndex === 'number' && expandedSectionIndex === sectionIndex;
  const isExpandedStandalone = sectionIndex === undefined && standaloneExpanded;
  const isExpanded =
    mode === 'IntakeForm' && (isExpandedFromContainer || isExpandedStandalone);

  const handleAccordionToggle = useCallback(() => {
    if (mode !== 'IntakeForm') return;
    if (sectionIndex === undefined) {
      setStandaloneExpanded((prev) => !prev);
    } else if (isAccessible && onExpandSection) {
      onExpandSection(sectionIndex);
    }
  }, [mode, sectionIndex, isAccessible, onExpandSection]);

  return { isExpanded, handleAccordionToggle };
};
