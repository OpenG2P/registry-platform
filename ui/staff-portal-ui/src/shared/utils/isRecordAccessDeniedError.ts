const RECORD_ACCESS_DENIED_ERROR = "RECORD_ACCESS_DENIED";
const RECORD_ACCESS_DENIED_CODE = "REG-ERR-012";

export function isRecordAccessDeniedError(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;

    const { error, code } = data as { error?: string; code?: string };

    return (
        error === RECORD_ACCESS_DENIED_ERROR ||
        code === RECORD_ACCESS_DENIED_CODE
    );
}