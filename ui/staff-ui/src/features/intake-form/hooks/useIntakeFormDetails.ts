import { useMemo } from "react";
import { useFetch } from "@/shared/hooks/useFetch";
import { withRuntimeGeoLevels } from "@/shared/utils/geoWidgets";
import { RenderedIntakeForm } from "../types/intake-form";

export const useIntakeFormDetails = (intakeFormId?: string) => {
    const { data, loading, error } = useFetch<RenderedIntakeForm>({
        url: "/api/intake-form/render-intake-form",
        options: {
            method: "POST",
            body: JSON.stringify({
                form_id: intakeFormId
            }),
        },
        enabled: !!(intakeFormId),
    });


    // Location widgets take the geography's levels from Master Data at runtime.
    const sections = useMemo(
        () => data?.tabs[0].sections
            ?.slice()
            .sort((a, b) => a.section_order - b.section_order)
            .map((section) => {
                const section_ui_schema = withRuntimeGeoLevels(section.section_ui_schema);
                return section_ui_schema === section.section_ui_schema ? section : { ...section, section_ui_schema };
            }),
        [data],
    );

    return {
        sections,
        // TODO: Assuming only one tab for now, may need to be updated later
        form_name: data?.form_mnemonic,
        form_description: data?.form_description,
        loading,
        error,
    };
};
