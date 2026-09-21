import "server-only";

import { createHmac } from "crypto";
import { cache } from "react";

import { getServerEnv } from "./env-config";
import { requireAuthFromCookies } from "./requireAuth";

export type NotificationHmac = {
    subscriberId?: string;
    subscriberHash?: string;
};

function subscriberIdFromAccessToken(accessToken: string): string | undefined {
    try {
        const payloadSegment = accessToken.split(".")[1];
        if (!payloadSegment) return undefined;

        const payload = JSON.parse(
            Buffer.from(payloadSegment, "base64url").toString("utf8")
        ) as Record<string, unknown>;

        const id = payload.preferred_username;
        return typeof id === "string" && id.trim() ? id.trim() : undefined;
    } catch {
        return undefined;
    }
}

export const getNotificationHmac = cache(
    async (): Promise<NotificationHmac> => {
        const auth = await requireAuthFromCookies();
        if (!auth) return {};

        const subscriberId = subscriberIdFromAccessToken(auth.accessToken);
        if (!subscriberId) return {};

        const secret = getServerEnv().notificationSecretKey;
        if (!secret) return { subscriberId };

        return {
            subscriberId,
            subscriberHash: createHmac("sha256", secret).update(subscriberId).digest("hex"),
        };
    }
);
