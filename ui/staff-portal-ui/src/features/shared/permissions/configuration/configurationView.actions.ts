import { CONFIGURATION_ATTRIBUTES_ACTIONS } from "./configurationAttributes.actions";
import { CONFIGURATION_DATA_MODELS_ACTIONS } from "./configurationDataModels.actions";
import { CONFIGURATION_INGESTION_TEMPLATES_ACTIONS } from "./configurationIngestionTemplates.actions";
import { CONFIGURATION_INTAKE_FORM_ACTIONS } from "./configurationIntakeForm.actions";
import { CONFIGURATION_KEY_PATHS_ACTIONS } from "./configurationKeyPaths.actions";
import { CONFIGURATION_OUTGESTION_TEMPLATES_ACTIONS } from "./configurationOutgestionTemplates.actions";
import { CONFIGURATION_OUTGESTION_TOPICS_ACTIONS } from "./configurationOutgestionTopics.actions";
import { CONFIGURATION_REGISTERS_ACTIONS } from "./configurationRegisters.actions";
import { CONFIGURATION_REGISTRY_ACTIONS } from "./configurationRegistry.actions";
import { CONFIGURATION_SEMANTIC_PATTERNS_ACTIONS } from "./configurationSemanticPatterns.actions";
import { CONFIGURATION_SUBSCRIPTION_ACTIONS } from "./configurationSubscription.actions";

/**
 * Controls Configuration nav/button and the /configuration shell.
 *
 * Deliberately excludes read-only metadata permissions (registerDefinition:view,
 * registerTab:view, registerSection:view, referenceData:view, registerScore:view)
 * that operational roles need for register/CR pages — those must not unlock config UI.
 */
export const CONFIG_NAV_ACTIONS = [
    CONFIGURATION_REGISTRY_ACTIONS.view,
    CONFIGURATION_REGISTERS_ACTIONS.create,
    CONFIGURATION_ATTRIBUTES_ACTIONS.create,
    CONFIGURATION_DATA_MODELS_ACTIONS.view,
    CONFIGURATION_INTAKE_FORM_ACTIONS.view,
    CONFIGURATION_INGESTION_TEMPLATES_ACTIONS.view,
    CONFIGURATION_KEY_PATHS_ACTIONS.view,
    CONFIGURATION_SEMANTIC_PATTERNS_ACTIONS.view,
    CONFIGURATION_SUBSCRIPTION_ACTIONS.view,
    CONFIGURATION_OUTGESTION_TEMPLATES_ACTIONS.view,
    CONFIGURATION_OUTGESTION_TOPICS_ACTIONS.view,
] as const;

/** @deprecated Use CONFIG_NAV_ACTIONS */
export const CONFIG_VIEW_ACTIONS = CONFIG_NAV_ACTIONS;
