"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import type { Indicator, IndicatorResult } from "../types";
import { humanize } from "../utils/labels";

/** Configured indicators over the register's projection, each as a table with a proportional bar. */
export default function Indicators({ registerMnemonic }: { registerMnemonic: string }) {
    const api = useActivityApi();
    const [indicators, setIndicators] = useState<Indicator[]>([]);
    const [results, setResults] = useState<Record<string, IndicatorResult>>({});

    useEffect(() => {
        api<Indicator[]>("get_indicators", { register_mnemonic: registerMnemonic })
            .then(async ({ data }) => {
                setIndicators(data ?? []);
                const computed: Record<string, IndicatorResult> = {};
                for (const indicator of data ?? []) {
                    try {
                        const { data: result } = await api<IndicatorResult>("compute_indicator", {
                            register_mnemonic: registerMnemonic, indicator_code: indicator.indicator_code,
                        });
                        computed[indicator.indicator_code] = result;
                    } catch (error) {
                        toast.error(`${indicator.display_name}: ${errorMessage(error)}`);
                    }
                }
                setResults(computed);
            })
            .catch((error) => toast.error(errorMessage(error)));
    }, [api, registerMnemonic]);

    if (!indicators.length) return <p className="text-sm opacity-70">No indicators are configured for this register.</p>;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {indicators.map((indicator) => {
                const result = results[indicator.indicator_code];
                const max = Math.max(1, ...(result?.rows ?? []).map((r) => Number(r.value) || 0));
                return (
                    <section key={indicator.indicator_code} className="rounded-[10px] bg-neutral-second p-4 flex flex-col gap-3">
                        <h3 className="font-medium">{indicator.display_name}{indicator.unit ? ` (${indicator.unit})` : ""}</h3>
                        {!result && <p className="text-sm opacity-70">Computing…</p>}
                        {result && result.rows.length === 0 && <p className="text-sm opacity-70">No data yet.</p>}
                        {result && result.rows.length > 0 && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left">
                                        {result.group_by.map((g) => <th key={g} className="py-1 pr-3 font-medium">{humanize(g)}</th>)}
                                        <th className="py-1 font-medium text-right">Value</th>
                                        <th className="py-1 w-1/3" aria-hidden />
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row, i) => (
                                        <tr key={i} className="border-t border-secondary-second">
                                            {result.group_by.map((g) => <td key={g} className="py-1.5 pr-3">{humanize(String(row[g] ?? "—"))}</td>)}
                                            <td className="py-1.5 text-right tabular-nums">{Number(row.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            <td className="py-1.5 pl-3">
                                                <div className="h-2 rounded-full bg-primary-first" style={{ width: `${(100 * (Number(row.value) || 0)) / max}%` }} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
