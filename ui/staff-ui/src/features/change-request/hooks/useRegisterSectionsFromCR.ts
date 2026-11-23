import { useMemo } from "react";
import { useFetch } from "@/shared/hooks/useFetch";
import { withRuntimeGeoLevels } from "@/shared/utils/geoWidgets";

interface Params {
  sectionId?: string;
  keepPreviousData?: boolean;
}

export const useRegisterSectionsFromCR = ({
  sectionId,
  keepPreviousData = true,
}: Params) => {
  // Fetch section (UI schema)
  const { data, loading: loadingSchema } = useFetch<any>({
    url: `/api/register/get-section-ui-schema`,
    enabled: !!sectionId,
    keepPreviousData,
    options: {
      method: "POST",
      body: JSON.stringify({
        section_id: sectionId,
      }),
    },
  });
  // Location widgets take the geography's levels from Master Data at runtime.
  const sectionUISchema = useMemo(
    () => withRuntimeGeoLevels(data?.sectionUiSchema.section_ui_schema),
    [data],
  );
  return {
    sectionUISchema,
    loadingSchema: !!sectionId ? loadingSchema : false
  };
};
