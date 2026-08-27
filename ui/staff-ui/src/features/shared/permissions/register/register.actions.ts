import { NestedValues } from "@/shared/types/types";

export const REGISTER_ACTIONS = {
    view: "register:view",
    export: "register:export",
} as const;

export type RegisterAction = NestedValues<typeof REGISTER_ACTIONS>;