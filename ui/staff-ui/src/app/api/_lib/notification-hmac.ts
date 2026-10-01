import "server-only";

import { createHmac } from "crypto";
import { cache } from "react";

import { getServerEnv } from "./env-config";
import { requireAuthFromCookies } from "./requireAuth";

export type NotificationHmac = {
    subscriberId?: string;
    subscriberHash?: string;
    subscriberEmail?: string;
    subscriberFirstName?: string;
};

function claimsFromAccessToken(accessToken: string): Omit<NotificationHmac, "subscriberHash"> {
    try {
        const payloadSegment = accessToken.split(".")[1];
        if (!payloadSegment) return {};

        const payload = JSON.parse(
            Buffer.from(payloadSegment, "base64url").toString("utf8")
        ) as {
            preferred_username?: string;
            email?: string;
            given_name?: string;
        };

        return {
            subscriberId: payload.preferred_username,
            subscriberEmail: payload.email,
            subscriberFirstName: payload.given_name,
        };
    } catch {
        return {};
    }
}

export const getNotificationHmac = cache(
    async (): Promise<NotificationHmac> => {
        const auth = await requireAuthFromCookies();
        if (!auth) return {};

        const { subscriberId, subscriberEmail, subscriberFirstName } =
            claimsFromAccessToken(auth.accessToken);
        if (!subscriberId) return {};

        const secret = getServerEnv().notificationSecretKey;
        if (!secret) return { subscriberId, subscriberEmail, subscriberFirstName };

        return {
            subscriberId,
            subscriberEmail,
            subscriberFirstName,
            subscriberHash: createHmac("sha256", secret).update(subscriberId).digest("hex"),
        };
    }
);
