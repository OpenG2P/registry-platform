import type { Activity } from "../types";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status }: { status: Activity["status"] }) {
    if (status === "ACTIVE") return null;
    const style = status === "VOIDED" ? "bg-toast-failed/15 text-toast-failed" : "bg-secondary-third";
    return <span className={`${pill} ${style}`}>{status === "VOIDED" ? "Voided" : "Superseded"}</span>;
}

export function VerificationBadge({ status }: { status: Activity["verification_status"] }) {
    if (status === "NOT_REQUIRED") return null;
    const styles: Record<string, string> = {
        SUBMITTED: "bg-toast-warning/20 text-neutral-first",
        VERIFIED: "bg-toast-success/20 text-toast-success",
        REJECTED: "bg-toast-failed/15 text-toast-failed",
    };
    const labels: Record<string, string> = { SUBMITTED: "Awaiting verification", VERIFIED: "Verified", REJECTED: "Rejected" };
    return <span className={`${pill} ${styles[status]}`}>{labels[status]}</span>;
}

export function DueBadge({ status }: { status: "DUE" | "OVERDUE" | "NOT_YET_DUE" }) {
    const styles = { DUE: "bg-toast-warning/20", OVERDUE: "bg-toast-failed/15 text-toast-failed", NOT_YET_DUE: "bg-secondary-third" };
    const labels = { DUE: "Due", OVERDUE: "Overdue", NOT_YET_DUE: "Not yet due" };
    return <span className={`${pill} ${styles[status]}`}>{labels[status]}</span>;
}

export function WarningCount({ warnings }: { warnings?: string[] | null }) {
    if (!warnings?.length) return null;
    return (
        <span className={`${pill} bg-toast-warning/20`} title={warnings.join("\n")}>
            {warnings.length} warning{warnings.length > 1 ? "s" : ""}
        </span>
    );
}
