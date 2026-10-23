"use client";

interface Props {
  activeTab: "intake_forms" | "intake_possible_duplicates" | "register_possible_duplicates";
  setActiveTab: (tab: "intake_forms" | "intake_possible_duplicates" | "register_possible_duplicates") => void;
  intakeResultsCount: number;
  regResultsCount: number;
  t: (key: string) => string;
}

export default function IntakeFormDeduplicationTabs({
  activeTab,
  setActiveTab,
  intakeResultsCount,
  regResultsCount,
  t,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2 lg:ml-7.5">
      <button
        onClick={() => setActiveTab("intake_forms")}
        className={`rounded-t-[10px] px-3 py-2 text-[14px] font-medium text-neutral-first transition-all sm:px-6 sm:text-[16px] lg:px-8 lg:text-[18px] ${activeTab === "intake_forms"
          ? 'bg-primary-first'
          : 'bg-secondary-second'
          }`}
      >
        {t("intake_forms")}
      </button>

      <button
        onClick={() => setActiveTab("intake_possible_duplicates")}
        className={`relative rounded-t-[10px] px-3 py-2 text-[14px] font-medium text-neutral-first sm:px-6 sm:text-[16px] lg:px-8 lg:text-[18px]
                    ${activeTab === "intake_possible_duplicates"
            ? "bg-primary-first"
            : "bg-secondary-second"
          }`}
      >
        {t("intake_possible_duplicates")}
        {intakeResultsCount > 0 && (
          <span className="absolute -top-3 right-3 bg-toast-failed text-neutral-second text-[12px] font-bold rounded-[10px] w-6 h-6 flex items-center justify-center shadow-sm">
            {String(intakeResultsCount).padStart(2, "0")}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab("register_possible_duplicates")}
        className={`relative rounded-t-[10px] px-3 py-2 text-[14px] font-medium text-neutral-first sm:px-6 sm:text-[16px] lg:px-8 lg:text-[18px]
                    ${activeTab === "register_possible_duplicates"
            ? "bg-primary-first"
            : "bg-secondary-second"
          }`}
      >
        {t("register_possible_duplicates")}
        {regResultsCount > 0 && (
          <span className="absolute -top-3 right-3 bg-toast-failed text-neutral-second text-[12px] font-bold rounded-[10px] w-6 h-6 flex items-center justify-center shadow-sm">
            {String(regResultsCount).padStart(2, "0")}
          </span>
        )}
      </button>
    </div>
  );
}
