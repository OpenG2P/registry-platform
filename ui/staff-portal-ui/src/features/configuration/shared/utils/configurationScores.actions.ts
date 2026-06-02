import { NestedValues } from "@/shared/types/types";

export const CONFIGURATION_SCORES_ACTIONS = {
    view: "registerScore:view",
    create: "registerScore:create",
    edit: "registerScore:edit",
} as const;

export type ConfigurationScoresAction = NestedValues<typeof CONFIGURATION_SCORES_ACTIONS>;
