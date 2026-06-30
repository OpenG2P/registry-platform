import { PanelConfig } from '../../../types';
import { UseBaseWidgetOptions } from '../../../hooks/useBaseWidget';
import { DataSourceRequestHandler } from '../../../types';
import { PanelRenderer } from '../../PanelRenderer';

export interface PanelGridProps {
  gridId?: string;
  panels: PanelConfig[];
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  isEditMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
  getPanelWrapperClassName?: (index: number, total: number) => string;
  wrapInContainer?: boolean;
}

export const PanelGrid = ({
  gridId,
  panels,
  dataSourceRequestHandler,
  schemaData,
  onValueChange,
  isEditMode,
  className = 'section-panels',
  style,
  getPanelWrapperClassName,
  wrapInContainer = true,
}: PanelGridProps) => {
  const content = panels.map((panel, index) => (
    <div
      key={panel['panel-id'] || `section-panel-${index}`}
      className={getPanelWrapperClassName?.(index, panels.length) ?? 'panel-wrapper'}
    >
      <PanelRenderer
        panel={panel}
        dataSourceRequestHandler={dataSourceRequestHandler}
        schemaData={schemaData}
        onValueChange={onValueChange}
        isEditMode={isEditMode}
      />
    </div>
  ));

  if (!wrapInContainer) {
    return <>{content}</>;
  }

  return (
    <div id={gridId} className={className} style={style}>
      {content}
    </div>
  );
};
