import { useState, useEffect, useRef, RefObject } from 'react';

export const useSectionEditPortal = (forceExitEdit?: boolean) => {
  const [isEditModeState, setIsEditMode] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [sectionHeight, setSectionHeight] = useState<number | null>(null);
  const [editSectionPosition, setEditSectionPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (forceExitEdit && isEditModeState) {
      setIsEditMode(false);
    }
  }, [forceExitEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEditModeState && sectionRef.current) {
      const updatePosition = () => {
        if (sectionRef.current) {
          const rect = sectionRef.current.getBoundingClientRect();
          setEditSectionPosition({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
          });
        }
      };

      requestAnimationFrame(updatePosition);
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition, { passive: true });

      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }

    setEditSectionPosition(null);
    setSectionHeight(null);
  }, [isEditModeState]);

  const enterEditMode = () => {
    if (sectionRef.current) {
      setSectionHeight(sectionRef.current.offsetHeight);
    }
    setIsEditMode(true);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
  };

  return {
    isEditMode: isEditModeState,
    setIsEditMode,
    sectionRef: sectionRef as RefObject<HTMLDivElement>,
    sectionHeight,
    editSectionPosition,
    enterEditMode,
    exitEditMode,
  };
};
