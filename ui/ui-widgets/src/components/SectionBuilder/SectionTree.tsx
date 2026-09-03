import React from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useWidgetContext } from '../WidgetProvider';

export type TreeNodeType = 'section' | 'panel' | 'widget';

export interface TreeNode {
  type: TreeNodeType;
  id: string;
  label: string;
  data: SectionConfig | PanelConfig | BaseWidgetConfig;
  children?: TreeNode[];
  parent?: TreeNode;
}

interface SectionTreeProps {
  section: SectionConfig;
  selectedNode?: TreeNode | null;
  onSelectNode: (node: TreeNode | null) => void;
  onAddPanel: (parentId: string, parentType: TreeNodeType) => void;
  onAddWidget: (parentId: string, widgetType?: string) => void;
  onDeleteNode: (node: TreeNode) => void;
  onDuplicateNode: (node: TreeNode) => void;
  onMoveNode?: (args: {
    kind: 'panel' | 'widget';
    parentPanelId: string | null;
    activeId: string;
    overId: string;
  }) => void;
}

type DragKind = 'panel' | 'widget';

function SortableRow({
  id,
  depth,
  selected,
  color,
  label,
  onClick,
  kind,
  parentPanelId,
  dragTitle,
}: {
  id: string;
  depth: number;
  selected: boolean;
  color: string;
  label: string;
  onClick: () => void;
  kind: DragKind;
  parentPanelId: string | null;
  dragTitle: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind, parentPanelId },
  });

  const style: React.CSSProperties = {
    marginLeft: `${depth * 16}px`,
    marginTop: '4px',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    position: 'relative',
    transition,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: `1px solid ${color}`,
    background: 'var(--owt-color-bg)',
    opacity: isDragging ? 0.6 : 1,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} onClick={onClick}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            userSelect: 'none',
            color: 'var(--owt-color-text-muted)',
            fontSize: '14px',
          }}
          title={dragTitle}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <span style={{ fontSize: '13px', fontWeight: selected ? 700 : 500, color: 'var(--owt-color-text)' }}>
          {label}
        </span>
      </span>
    </div>
  );
}

export const SectionTree: React.FC<SectionTreeProps> = ({
  section,
  selectedNode,
  onSelectNode,
  onMoveNode,
}) => {
  const { t } = useWidgetContext();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const dragTitle = t?.('sectionBuilder.dragToReorder') || 'Drag to reorder';

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onMoveNode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeData: any = active.data.current;
    const overData: any = over.data.current;
    if (!activeData || !overData) return;
    if (activeData.kind !== overData.kind) return;
    if (activeData.parentPanelId !== overData.parentPanelId) return;

    const kind: DragKind = activeData.kind;
    const parentPanelId: string | null = activeData.parentPanelId ?? null;
    const activeId = String(active.id).replace(/^panel:|^widget:/, '');
    const overId = String(over.id).replace(/^panel:|^widget:/, '');
    onMoveNode({ kind, parentPanelId, activeId, overId });
  };

  const renderPanels = (panels: PanelConfig[], depth: number, parentPanelId: string | null) => {
    const panelItemIds = panels.map((p) => `panel:${p['panel-id']}`);
    return (
      <SortableContext items={panelItemIds} strategy={verticalListSortingStrategy}>
        {panels.map((panel) => {
          const panelNode: TreeNode = {
            type: 'panel',
            id: panel['panel-id'],
            label: t?.('sectionBuilder.nodePanel', { id: panel['panel-id'] }) || `Panel: ${panel['panel-id']}`,
            data: panel,
          };
          const isSelected = selectedNode?.type === 'panel' && selectedNode.id === panelNode.id;
          return (
            <div key={panel['panel-id']}>
              <SortableRow
                id={`panel:${panel['panel-id']}`}
                depth={depth}
                selected={isSelected}
                color={isSelected ? 'var(--owt-color-primary-accent)' : 'var(--owt-color-border)'}
                label={panelNode.label}
                onClick={() => onSelectNode(panelNode)}
                kind="panel"
                parentPanelId={parentPanelId}
                dragTitle={dragTitle}
              />

              {panel.panels && panel.panels.length > 0 && renderPanels(panel.panels, depth + 1, panel['panel-id'])}

              {panel.widgets && panel.widgets.length > 0 && (
                <div style={{ marginTop: '2px' }}>
                  <SortableContext
                    items={panel.widgets.map((w) => `widget:${w['widget-id']}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {panel.widgets.map((w) => {
                      const widgetNode: TreeNode = {
                        type: 'widget',
                        id: w['widget-id'],
                        label:
                          t?.('sectionBuilder.nodeWidget', { id: w['widget-id'], widgetType: w.widget }) ||
                          `Widget: ${w['widget-id']} (${w.widget})`,
                        data: w,
                      };
                      const widgetSelected = selectedNode?.type === 'widget' && selectedNode.id === widgetNode.id;
                      return (
                        <SortableRow
                          key={w['widget-id']}
                          id={`widget:${w['widget-id']}`}
                          depth={depth + 1}
                          selected={widgetSelected}
                          color={widgetSelected ? 'var(--owt-color-success)' : 'var(--owt-color-border-light)'}
                          label={widgetNode.label}
                          onClick={() => onSelectNode(widgetNode)}
                          kind="widget"
                          parentPanelId={panel['panel-id']}
                          dragTitle={dragTitle}
                        />
                      );
                    })}
                  </SortableContext>
                </div>
              )}
            </div>
          );
        })}
      </SortableContext>
    );
  };

  const sectionNode: TreeNode = {
    type: 'section',
    id: section['section-id'],
    label: t?.('sectionBuilder.nodeSection', { id: section['section-id'] }) || `Section: ${section['section-id']}`,
    data: section,
  };

  const sectionSelected = selectedNode?.type === 'section' && selectedNode.id === sectionNode.id;

  return (
    <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            padding: '15px',
            overflowY: 'auto',
          }}
        >
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '15px', color: 'var(--owt-color-text)' }}>
          {t?.('sectionBuilder.structureTree') || 'Section Structure'}
        </h3>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            background: sectionSelected ? 'var(--owt-color-bg)' : 'var(--owt-color-primary-light)',
            border: '1px solid var(--owt-color-info)',
            marginBottom: '10px',
            cursor: 'pointer',
          }}
          onClick={() => onSelectNode(sectionNode)}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--owt-color-text)' }}>
            📁 {sectionNode.label}
          </span>
        </div>

        {Array.isArray(section.panels) && section.panels.length > 0 ? (
          renderPanels(section.panels, 0, null)
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--owt-color-text-muted)' }}>
            {t?.('sectionBuilder.noPanelsYet') || 'No panels yet. Use "+ Add Panel".'}
          </div>
        )}
        </div>
      </DndContext>
    </div>
  );
};
