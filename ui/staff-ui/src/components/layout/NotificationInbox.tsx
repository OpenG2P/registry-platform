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
                subscriberId: config.subscriberId,
                subscriberHash: config.subscriberHash,
                applicationIdentifier: config.notificationApplicationIdentifier,
                backendUrl: config.notificationBackendUrl,
                socketUrl: config.notificationWebsocketUrl,
            }}
            localization={{
                notifications: t("notifications"),
                empty: t("no_notifications"),
            }}
        />
    );
}
