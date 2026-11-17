import { useFetch } from "@/shared/hooks/useFetch";

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
  return {
    sectionUISchema: data?.sectionUiSchema.section_ui_schema,
    loadingSchema: !!sectionId ? loadingSchema : false
  };
};
