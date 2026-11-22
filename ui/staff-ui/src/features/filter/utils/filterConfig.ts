import { FilterConfig } from "../types/types";
import { useFetch } from "@/shared/hooks/useFetch";
import { useRegister } from "@/context/RegisterContext";

export function useFilterConfig(url: string, enabled = true) {
    const { currentRegister } = useRegister();
    const registerId = currentRegister?.register_id;

    const { data, loading, error } = useFetch<FilterConfig[]>({
        url,
        enabled: enabled && !!url && !!registerId,
        options: {
            method: "POST",
            body: JSON.stringify({ register_id: registerId }),
        },
    });

    return {
        filterConfig: data ?? [],
        loading,
        error,
    };
}
