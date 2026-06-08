import { NestedValues } from "@/shared/types/types";

export const CONFIGURATION_ATTRIBUTES_ACTIONS = {
    view: "referenceData:view",
    create: "referenceData:create",
    edit: "referenceData:edit",
    delete: "referenceData:delete",
} as const;

export type ConfigurationAttributesAction = NestedValues<
    typeof CONFIGURATION_ATTRIBUTES_ACTIONS
>;
