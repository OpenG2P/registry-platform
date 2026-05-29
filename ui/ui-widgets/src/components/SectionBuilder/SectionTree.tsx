import React from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';

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
  onAddWidget: (parentId: string) => void;
  onDeleteNode: (node: TreeNode) => void;
  onDuplicateNode: (node: TreeNode) => void;
}

/**
 * Recursively build tree nodes from panel structure
 */
function buildTreeNodesFromPanels(
  panels: PanelConfig[],
  parent?: TreeNode
): TreeNode[] {
  const nodes: TreeNode[] = [];

  panels.forEach((panel) => {
    const panelNode: TreeNode = {
      type: 'panel',
      id: panel['panel-id'],
      label: `Panel: ${panel['panel-id']}`,
      data: panel,
      parent: parent,
      children: [],
    };

    // Add nested panels recursively
    if (panel.panels && panel.panels.length > 0) {
      panelNode.children = panelNode.children || [];
      panelNode.children.push(...buildTreeNodesFromPanels(panel.panels, panelNode));
    }

    // Add widgets
    if (panel.widgets && panel.widgets.length > 0) {
      panelNode.children = panelNode.children || [];
      panel.widgets.forEach((widget) => {
        panelNode.children!.push({
          type: 'widget',
          id: widget['widget-id'],
          label: `Widget: ${widget['widget-id']} (${widget.widget})`,
          data: widget,
          parent: panelNode,
        });
      });
    }

    nodes.push(panelNode);
  });

  return nodes;
}

/**
 * Tree view component for section structure
 */
export const SectionTree: React.FC<SectionTreeProps> = ({
  section,
  selectedNode,
  onSelectNode,
  onAddPanel,
  onAddWidget,
  onDeleteNode,
  onDuplicateNode,
}) => {
  const treeNodes = React.useMemo(() => {
    if (section.panels && section.panels.length > 0) {
      return buildTreeNodesFromPanels(section.panels);
    }
    return [];
  }, [section]);

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isSelected = selectedNode?.id === node.id && selectedNode?.type === node.type;
    const indent = level * 20;

    const getNodeStyles = () => {
      const baseStyles: React.CSSProperties = {
        marginLeft: `${indent}px`,
        marginTop: '4px',
        padding: '8px 12px',
        borderRadius: '4px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      };

      if (isSelected) {
        switch (node.type) {
          case 'section':
            return { ...baseStyles, background: '#e3f2fd', border: '1px solid #2196f3' };
          case 'panel':
            return { ...baseStyles, background: '#fff3e0', border: '1px solid #ff9800' };
          case 'widget':
            return { ...baseStyles, background: '#e8f5e9', border: '1px solid #4caf50' };
        }
      }

      switch (node.type) {
        case 'section':
          return { ...baseStyles, background: '#e3f2fd', border: '1px solid #2196f3' };
        case 'panel':
          return { ...baseStyles, background: '#fff3e0', border: '1px solid #ff9800' };
        case 'widget':
          return { ...baseStyles, background: '#e8f5e9', border: '1px solid #4caf50' };
      }

      return baseStyles;
    };

    const getIcon = () => {
      switch (node.type) {
        case 'section':
          return '📁';
        case 'panel':
          return '📦';
        case 'widget':
          return '🔧';
      }
    };

    const getActionButtonColor = () => {
      switch (node.type) {
        case 'section':
          return '#2196f3';
        case 'panel':
          return '#ff9800';
        case 'widget':
          return '#4caf50';
      }
    };

    return (
      <div key={node.id}>
        <div
          style={getNodeStyles()}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(node);
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget;
            const actionBtn = target.querySelector('.tree-action-btn') as HTMLElement;
            if (actionBtn) actionBtn.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget;
            const actionBtn = target.querySelector('.tree-action-btn') as HTMLElement;
            if (actionBtn) actionBtn.style.opacity = '0';
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{getIcon()}</span>
            <span style={{ fontSize: '13px' }}>{node.label}</span>
          </span>
          <button
            className="tree-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(node);
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: 'none',
              background: getActionButtonColor(),
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              opacity: isSelected ? '1' : '0',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⚙
          </button>
        </div>
        {node.children && node.children.length > 0 && (
          <div style={{ marginLeft: `${indent + 20}px` }}>
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
      <div
        style={{
          padding: '15px',
          overflowY: 'auto',
          background: '#f8f9fa',
          height: '100%',
        }}
      >
        <h3 style={{ fontSize: '14px', marginBottom: '15px', color: '#2c3e50' }}>
          Section Structure
        </h3>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            background: '#e3f2fd',
            border: '1px solid #2196f3',
            marginBottom: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onClick={() => {
            const sectionNode: TreeNode = {
              type: 'section',
              id: section['section-id'],
              label: `Section: ${section['section-id']}`,
              data: section,
              children: treeNodes,
            };
            onSelectNode(sectionNode);
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📁</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Section: {section['section-id']}
            </span>
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const sectionNode: TreeNode = {
                type: 'section',
                id: section['section-id'],
                label: `Section: ${section['section-id']}`,
                data: section,
                children: treeNodes,
              };
              onSelectNode(sectionNode);
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: 'none',
              background: '#2196f3',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ⚙
          </button>
        </div>
      {treeNodes.map((node) => renderTreeNode(node, 0))}
    </div>
  );
};
