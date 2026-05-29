/**
 * Scores Display Widget Example
 *
 * Demonstrates the ScoresDisplayWidget in a full-width section.
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';

const schemaData = {
  scores: [
    {
      score_type: 'PMT',
      computed_score: 42,
      computed_at: '2026-04-16T10:12:00Z',
      triggered_by_cr_id: 'CR-001',
    },
    {
      score_type: 'FSS',
      computed_score: 0.78,
      computed_at: '2026-03-10T08:30:00Z',
      triggered_by_cr_id: 'CR-000',
    },
    {
      score_type: 'Poverty Score',
      computed_score: 18,
      computed_at: '2026-01-02T09:05:00Z',
      triggered_by_cr_id: 'CR-000',
    },
  ],
};

const scoresSection: SectionConfig = {
  'section-id': 'scores',
  'section-title': '',
  'section-editable': false,
  'section-column-span': 3,
  'section-hide-edit-button': true, // Hide the edit button band below the section
  panels: [
    {
      'panel-id': 'scores-panel',
      'panel-orientation': 'vertical',
      'panel-column-span': 3,
      widgets: [
        {
          widget: 'scores-display',
          'widget-type': 'group',
          'widget-id': 'record-scores',
          'widget-readonly': true,
          'widget-data-path': 'scores',
        },
      ],
    },
  ],
};

export const ScoresDisplayExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  return (
    <WidgetProvider store={store} schemaData={schemaData}>
      <div style={{ padding: '24px', maxWidth: '1241px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', margin: '0 0 24px 0' }}>
          Registry View — Scores Display Widget
        </h1>
        <SectionsContainer sections={[scoresSection]} schemaData={schemaData} mode="RegistryView" hideEditButton />
      </div>
    </WidgetProvider>
  );
};

export default ScoresDisplayExample;

