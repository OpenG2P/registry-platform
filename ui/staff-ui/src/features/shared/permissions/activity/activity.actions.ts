import { NestedValues } from "@/shared/types/types";

export const ACTIVITY_ACTIONS = {
    view: "activity:view",
    create: "activity:create",
    correct: "activity:correct",
    verify: "activity:verify",
    configure: "activity:configure",
} as const;

export type ActivityAction = NestedValues<typeof ACTIVITY_ACTIONS>;
