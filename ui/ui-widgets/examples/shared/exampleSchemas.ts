import { loadSectionSchema } from './loadExampleSchema';

import dialogTableSectionRaw from '../../example-ui-schema/sections/dialog-table-section.jsonc?raw';
import docsWidgetSectionRaw from '../../example-ui-schema/sections/docs-widget-section.jsonc?raw';
import geoHierarchySectionRaw from '../../example-ui-schema/sections/geo-hierarchy-section.jsonc?raw';
import headerSectionRaw from '../../example-ui-schema/sections/header-section.jsonc?raw';
import idAuthenticationRaw from '../../example-ui-schema/sections/id-authentication-section.jsonc?raw';
import registerLookupRaw from '../../example-ui-schema/sections/register-lookup-section.jsonc?raw';
import normalSectionRaw from '../../example-ui-schema/sections/normal-section.jsonc?raw';
import normalSection2Raw from '../../example-ui-schema/sections/normal-section-2.jsonc?raw';
import scoresDisplayRaw from '../../example-ui-schema/sections/scores-display-section.jsonc?raw';
import tableSectionRaw from '../../example-ui-schema/sections/table-section.jsonc?raw';
import widgetExploreSection1Raw from '../../example-ui-schema/sections/widget-explore-section1.jsonc?raw';
import widgetExploreSection2Raw from '../../example-ui-schema/sections/widget-explore-section2.jsonc?raw';
import widgetExploreSection3Raw from '../../example-ui-schema/sections/widget-explore-section3.jsonc?raw';

export const dialogTableSection = loadSectionSchema(dialogTableSectionRaw);

export const headerSection = loadSectionSchema(headerSectionRaw, {
  registerId: 'registrant',
});

export const idAuthenticationSection = loadSectionSchema(idAuthenticationRaw, {
  registerId: 'registrant',
});

export const registerLookupSection = loadSectionSchema(registerLookupRaw);

export const normalSection = loadSectionSchema(normalSectionRaw);
export const normalSection2 = loadSectionSchema(normalSection2Raw);
export const scoresDisplaySection = loadSectionSchema(scoresDisplayRaw);
export const tableSection = loadSectionSchema(tableSectionRaw);
export const docsWidgetSection = loadSectionSchema(docsWidgetSectionRaw);
export const geoHierarchySection = loadSectionSchema(geoHierarchySectionRaw);

export const widgetExploreSections = [
  loadSectionSchema(widgetExploreSection1Raw),
  loadSectionSchema(widgetExploreSection2Raw),
  loadSectionSchema(widgetExploreSection3Raw),
];

export const sectionBuilderInitialSection = normalSection;

export const intakeFormSections = [
  normalSection,
  normalSection2,
];

export const registerSections = [
  normalSection,
  normalSection2,
  geoHierarchySection,
  tableSection,
  docsWidgetSection,
];

export const changeRequestSection = normalSection;

export const specialSections = [
  headerSection,
  scoresDisplaySection,
  idAuthenticationSection,
  registerLookupSection,
  dialogTableSection,
];

export const THEME_REGISTER_ID = 'theme-demo';

export const themeSections = [
  loadSectionSchema(headerSectionRaw, { registerId: THEME_REGISTER_ID }),
  loadSectionSchema(normalSectionRaw, { registerId: THEME_REGISTER_ID }),
  scoresDisplaySection,
  loadSectionSchema(tableSectionRaw, { registerId: THEME_REGISTER_ID }),
];
