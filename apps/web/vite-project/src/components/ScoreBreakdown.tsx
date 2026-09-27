import { useState } from "react";
import { WEIGHT_NOTE, topReasons, type ScorePart } from "../viz/ranking";

// Разбор оценки подбора (ТЗ 3.4.5): сколько баллов дал каждый фактор и почему.
// Свёрнутый вид — две главные причины строкой, развёрнутый — все факторы с полосами.

const zone = (score: number) =>
    score >= 75
        ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        : score >= 50
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

export function ScoreBadge({ score, rank }: { score: number; rank: number }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${zone(score)}`}>
            <span className="opacity-70">#{rank}</span>
            {score} / 100
        </span>
    );
}

export function ScoreBreakdown({ parts }: { parts: ScorePart[] }) {
    const [open, setOpen] = useState(false);
    const top = topReasons(parts);

    return (
        <div className="mt-2">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                aria-expanded={open}
            >
                {open ? "▾ Скрыть разбор оценки" : "▸ Почему такая оценка"}
            </button>

            {!open && (
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    Больше всего дали: {top.map((p) => `${p.label.toLowerCase()} (${p.points})`).join(", ")}
                </p>
            )}

            {open && (
                <ul className="mt-2 space-y-2">
                    {parts.map((p) => (
                        <li key={p.key}>
                            <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{p.label}</span>
                                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                                    {p.points} из {p.weight}
                                </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                    className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 motion-reduce:transition-none"
                                    style={{ width: `${Math.round(p.value * 100)}%` }}
                                />
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{p.note}</p>
                        </li>
                    ))}
                    <li className="pt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{WEIGHT_NOTE}</li>
                </ul>
            )}
        </div>
    );
}
