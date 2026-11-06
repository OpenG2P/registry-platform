"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterConfig, FilterRule } from "@/features/filter/types";

import {
    TextFilterInput,
    NumberFilterInput,
    DateFilterInput,
    SelectFilterInput,
} from "@/features/filter/components";
import { validateFilters } from "@/features/filter/utils";

interface FilterDropdownProps {
    onApply: (filters: FilterRule[]) => void;
    onClose?: () => void;
    appliedFilters?: FilterRule[];
    filterConfig?: FilterConfig[];
}

const OPERATOR_KEYS: Record<string, string> = {
    eq: "filter_operator_eq",
    neq: "filter_operator_neq",
    in: "filter_operator_in",
    nin: "filter_operator_nin",
    contains: "filter_operator_contains",
    ncontains: "filter_operator_ncontains",
    startsWith: "filter_operator_startsWith",
    endsWith: "filter_operator_endsWith",
    gt: "filter_operator_gt",
    gte: "filter_operator_gte",
    lt: "filter_operator_lt",
    lte: "filter_operator_lte",
    isNull: "filter_operator_isNull",
    between: "filter_operator_between",
};

export default function FilterDropdown({
    onApply,
    onClose,
    appliedFilters = [],
    filterConfig = [],
}: FilterDropdownProps) {
    const t = useTranslations();
    const [selectedFieldName, setSelectedFieldName] = useState("");
    const [operator, setOperator] = useState("");
    const [value, setValue] = useState<any>("");
    const [error, setError] = useState<string | null>(null);

    const configMap: Record<string, FilterConfig> = Object.fromEntries(
        filterConfig.map(cfg => [cfg.field_name, cfg])
    );

    const sortedConfig = [...filterConfig].sort((a, b) => a.order - b.order);

    useEffect(() => {
        setError(null);
    }, [selectedFieldName, operator, value]);


    useEffect(() => {
        if (!selectedFieldName && sortedConfig.length > 0) {
            setSelectedFieldName(sortedConfig[0].field_name);
        }
    }, [sortedConfig, selectedFieldName]);

    const selectedFilter = sortedConfig.find(f => f.field_name === selectedFieldName);

    useEffect(() => {
        if (!selectedFilter) return;

        setOperator("");
    }, [selectedFieldName, selectedFilter]);

    useEffect(() => {
        if (!selectedFilter || !operator) {
            setValue("");
            return;
        }

        const existing = appliedFilters.find(
            f => f.field_name === selectedFilter.field_name && f.operator === operator
        );

        setValue(existing ? existing.value : "");
    }, [selectedFilter, operator, appliedFilters]);

    const applyFilter = () => {
        if (!selectedFilter || !operator) return;

        const newFilter: FilterRule = {
            field_name: selectedFilter.field_name,
            operator,
            value,
        };

        const updatedFilters = [
            ...appliedFilters.filter(
                f => !(f.field_name === newFilter.field_name && f.operator === newFilter.operator)
            ),
            newFilter,
        ];

        const validationErrors = validateFilters(updatedFilters, configMap);

        if (validationErrors.length > 0) {
            const currentError = validationErrors.find(
                e => e.filterId === selectedFilter.field_name
            );

            if (currentError) {
                setError(currentError.message);
                return;
            }
        }

        setError(null);
        onApply(updatedFilters);
    };


    if (filterConfig.length === 0) {
        return (
            <div className="flex max-w-[calc(100vw-1.5rem)] items-center justify-center p-6 sm:min-w-110 sm:p-10">
                <p className="text-neutral-first/50">{t("filter_loading")}</p>
            </div>
        );
    }

    const renderValueInput = () => {
        if (!selectedFilter) return null;

        const commonProps = {
            value,
            operator,
            onChange: setValue,
            placeholder: t("filter_search_placeholder", { field: t(selectedFilter.display_label) }),
        };

        switch (selectedFilter.filter_type) {
            case "text":
                return <TextFilterInput {...commonProps} />;

            case "number_range":
                return <NumberFilterInput {...commonProps} />;

            case "date_range":
                return <DateFilterInput {...commonProps} />;

            case "dropdown":
                return (
                    <SelectFilterInput
                        {...commonProps}
                        options_source={selectedFilter.options_source}
                    />
                );

            case "boolean":
                return (
                    <div className="relative w-full">
                        <select
                            className="border border-secondary-second rounded-[10px] px-3 py-2 text-sm w-full appearance-none bg-neutral-second pr-10 focus:outline-none focus:border-gray-400 text-neutral-first/50 font-['Roboto'] font-normal h-10"
                            value={value === true ? "true" : value === false ? "false" : ""}
                            onChange={e => {
                                if (e.target.value === "") return setValue("");
                                setValue(e.target.value === "true");
                            }}
                        >
                            <option value="">{t("common.select")}</option>
                            <option value="true">{t("true")}</option>
                            <option value="false">{t("false")}</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <Image
                                src="/images/common/down_arrow.png"
                                alt=""
                                width={14}
                                height={8}
                                className="h-auto"
                            />
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div
            className="relative flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[10px] border border-primary-first bg-neutral-second font-['Roboto'] sm:min-h-[300px] sm:w-max sm:min-w-[min(500px,calc(100vw-2rem))] sm:max-w-[min(40rem,calc(100vw-2rem))] sm:overflow-visible sm:flex-row"
            style={{ boxShadow: '0 0 8px 0 rgba(0, 0, 0, 0.25)' }}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10"
            >
                <Image
                    src="/images/common/filter_close.png"
                    alt={t("filter_close")}
                    width={20}
                    height={20}
                    className="h-4 w-4 sm:h-5 sm:w-5"
                />
            </button>

            {/* Left Sidebar */}
            <div className="flex w-full min-w-0 gap-2 overflow-x-auto bg-secondary-second/50 px-3 pb-3 pt-12 sm:w-[148.9px] sm:shrink-0 sm:flex-col sm:overflow-visible sm:rounded-l-[10px] sm:px-3 sm:pb-4 sm:pt-[63.3px]">
                {sortedConfig.map(filter => {
                    const isActive = filter.field_name === selectedFieldName;
                    return (
                        <button
                            key={filter.field_name}
                            onClick={() => setSelectedFieldName(filter.field_name)}
                            className={`flex min-h-[40px] w-auto shrink-0 items-center truncate py-2 px-4 text-left text-[14px] font-medium capitalize leading-tight transition-colors sm:w-full
    ${isActive
                                    ? "bg-primary-first text-neutral-first rounded-[20px]"
                                    : "text-neutral-first/50 rounded-[20px]"}`}
                        >
                            {t(filter.display_label)}
                        </button>
                    );
                })}
            </div>

            {/* Right Side Content */}
            <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
                <div className="text-[18px] font-medium text-primary-second leading-[20px] mb-6">
                    {selectedFilter && t("filter_search_by", { field: t(selectedFilter.display_label) })}
                </div>

                {selectedFilter && (
                    <div className="flex-1 space-y-4">
                        {/* Operator Label/Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[16px] font-normal text-neutral-first leading-none">
                                {t("select_operator")}
                            </label>
                            <div className="relative w-full">
                                <select
                                    className="border border-secondary-second rounded-[10px] px-3 text-[16px] font-normal w-full appearance-none bg-neutral-second pr-10 outline-0 h-[36px] text-neutral-first/50"
                                    value={operator}
                                    onChange={e => setOperator(e.target.value)}
                                >
                                    <option value="" disabled hidden>{t("common.select")}</option>
                                    {selectedFilter.allowed_operators.map(op => (
                                        <option key={op} value={op}>
                                            {t(OPERATOR_KEYS[op] ?? op)}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 opacity-50">
                                    <Image
                                        src="/images/common/down_arrow.png"
                                        alt=""
                                        width={14}
                                        height={8}
                                        className="h-auto"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Name Label/Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[16px] font-normal text-neutral-first leading-none">
                                {t(selectedFilter.display_label)}
                            </label>
                            {renderValueInput()}
                        </div>

                        {error && (
                            <p className="text-xs text-toast-failed">
                                {error}
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-4">
                    <button
                        onClick={applyFilter}
                        className="bg-neutral-first text-neutral-second px-8 py-2 rounded-full text-[16px] font-medium h-10 flex items-center justify-center transition-opacity hover:opacity-90"
                    >
                        {t("apply")}
                    </button>
                </div>
            </div>
        </div>
    );
}
