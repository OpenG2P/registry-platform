"use client";

import { Inbox } from "@openg2p/notification";
import { useTranslations } from "next-intl";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";

export default function NotificationInbox() {
    const t = useTranslations();
    const { config } = useRuntimeConfig();

    if (!config.notificationProvider || !config.notificationApplicationIdentifier || !config.subscriberId) {
        return null;
    }

    return (
        <Inbox
            config={{
                provider: config.notificationProvider,
                subscriberHash: config.subscriberHash,
                applicationIdentifier: config.notificationApplicationIdentifier,
                backendUrl: config.notificationBackendUrl,
                socketUrl: config.notificationWebsocketUrl,
                subscriber: {
                    subscriberId: config.subscriberId,
                    email: config.subscriberEmail,
                    firstName: config.subscriberFirstName,
                },
            }}
            theme={{
                accent: "var(--color-primary-first)",
                accentHover: "var(--color-primary-second)",
                surface: "var(--color-neutral-second)",
                surfaceMuted: "var(--color-secondary-first)",
                text: "var(--color-neutral-first)",
                textMuted: "var(--color-secondary-third)",
                border: "var(--color-secondary-second)",
                onAccent: "var(--color-neutral-second)",
            }}
            localization={{
                notifications: t("notifications"),
                empty: t("no_notifications"),
            }}
        />
    );
}
