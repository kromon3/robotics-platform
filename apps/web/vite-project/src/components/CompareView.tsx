import { useId, useState, type ReactNode } from "react";
import { NO_DATA, analyzeRows, hasAnyValue, type CompareRow } from "../lib/compare";

// Таблица сравнения «бок о бок» — общая для каталога и витрины подбора.
// Главное — сразу видно, чем решения отличаются: строки с разными значениями подсвечены,
// лучшее значение в строке отмечено, «Только различия» прячет совпадающие строки.

type Props<T> = {
    title: string;
    items: T[];
    rows: CompareRow<T>[];
    /** Порядок групп строк */
    groups: string[];
    getId: (item: T) => string;
    getName: (item: T) => string;
    /** Шапка колонки: название, фото, бейджи */
    renderHeader: (item: T) => ReactNode;
    /** Действия под колонкой */
    renderFooter?: (item: T) => ReactNode;
    /** Колонка, которую подсвечиваем (рекомендованное решение) */
    highlightId?: string;
    defaultOnlyDiff?: boolean;
    onRemove: (id: string) => void;
    onClear?: () => void;
    clearLabel?: string;
    note?: ReactNode;
};

const labelCell =
    "sticky left-0 z-10 w-48 min-w-[11rem] px-3 py-2 text-left align-top text-xs font-medium text-slate-500 dark:text-slate-400";
const highlightCol = "bg-indigo-50/60 dark:bg-indigo-950/30";
const bestChip = "rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800 dark:bg-green-950/60 dark:text-green-300";

export function CompareView<T>({
    title,
    items,
    rows,
    groups,
    getId,
    getName,
    renderHeader,
    renderFooter,
    highlightId,
    defaultOnlyDiff = false,
    onRemove,
    onClear,
    clearLabel = "Сбросить",
    note,
}: Props<T>) {
    const [onlyDiff, setOnlyDiff] = useState(defaultOnlyDiff);
    const toggleId = useId();

    // Строки, где ни у кого нет данных, не показываем вовсе — сравнивать там нечего
    const analyzed = analyzeRows(
        rows.filter((r) => hasAnyValue(r, items)),
        items,
    );
    const diffCount = analyzed.filter((a) => a.differs).length;
    const visible = onlyDiff ? analyzed.filter((a) => a.differs) : analyzed;
    const hiddenCount = analyzed.length - visible.length;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {title} — {items.length}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                        {items.length < 2
                            ? "Добавьте ещё решение, чтобы увидеть различия"
                            : diffCount === 0
                              ? "Все показанные параметры совпадают"
                              : `Различаются ${diffCount} из ${analyzed.length} параметров`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <ul className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400" aria-label="Обозначения">
                        <li className="flex items-center gap-1.5">
                            <span className="inline-block h-3 w-3 rounded-sm border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/60" aria-hidden />
                            различается
                        </li>
                        <li className="flex items-center gap-1.5">
                            <span className={`${bestChip} px-1 py-0 text-[10px]`} aria-hidden>
                                ★
                            </span>
                            лучшее в строке
                        </li>
                    </ul>
                    <label htmlFor={toggleId} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <input
                            id={toggleId}
                            type="checkbox"
                            checked={onlyDiff}
                            onChange={(e) => setOnlyDiff(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-700"
                        />
                        Только различия{hiddenCount > 0 && onlyDiff ? ` (скрыто ${hiddenCount})` : ""}
                    </label>
                    {onClear && (
                        <button type="button" onClick={onClear} className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400">
                            {clearLabel}
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed border-collapse">
                    <caption className="sr-only">
                        {title}: строки с различающимися значениями помечены, лучшее значение отмечено звёздочкой
                    </caption>
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th scope="col" className={`${labelCell} bg-white dark:bg-slate-900`}>
                                <span className="sr-only">Параметр</span>
                            </th>
                            {items.map((item) => (
                                <th
                                    key={getId(item)}
                                    scope="col"
                                    className={`px-3 py-2 text-left align-top ${getId(item) === highlightId ? highlightCol : ""}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">{renderHeader(item)}</div>
                                        <button
                                            type="button"
                                            onClick={() => onRemove(getId(item))}
                                            aria-label={`Убрать ${getName(item)} из сравнения`}
                                            title="Убрать из сравнения"
                                            className="rounded px-1 text-lg leading-none text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-slate-200"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {groups.map((group) => {
                        const groupRows = visible.filter((a) => a.row.group === group);
                        if (groupRows.length === 0) return null;
                        return (
                            <tbody key={group} className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr>
                                    <th
                                        scope="colgroup"
                                        colSpan={items.length + 1}
                                        className="bg-slate-50 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400"
                                    >
                                        {group}
                                    </th>
                                </tr>
                                {groupRows.map(({ row, differs, best }) => (
                                    <tr key={row.label} className={differs ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}>
                                        <th
                                            scope="row"
                                            className={`${labelCell} ${
                                                differs
                                                    ? "border-l-4 border-amber-400 bg-amber-50 text-slate-700 dark:bg-[#2a1f12] dark:text-slate-200"
                                                    : "border-l-4 border-transparent bg-white dark:bg-slate-900"
                                            }`}
                                        >
                                            {row.label}
                                            {row.hint && (
                                                <span className="mt-0.5 block text-[10px] font-normal text-slate-400 dark:text-slate-500">{row.hint}</span>
                                            )}
                                            {differs && <span className="sr-only"> (значения различаются)</span>}
                                        </th>
                                        {items.map((item, idx) => {
                                            const v = row.value(item);
                                            const tone = row.tone?.(item) ?? null;
                                            const isBest = best.has(idx);
                                            const href = row.href?.(item) ?? null;
                                            return (
                                                <td
                                                    key={getId(item)}
                                                    className={`px-3 py-2 align-top text-sm tabular-nums ${getId(item) === highlightId ? highlightCol : ""}`}
                                                >
                                                    {v === null ? (
                                                        <span className="text-xs italic text-slate-400 dark:text-slate-500">{NO_DATA}</span>
                                                    ) : href ? (
                                                        <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="break-all text-indigo-600 hover:underline dark:text-indigo-400"
                                                        >
                                                            {v}
                                                        </a>
                                                    ) : (
                                                        <span
                                                            className={tone ? `rounded px-1.5 py-0.5 font-medium ${tone}` : isBest ? bestChip : ""}
                                                            title={isBest ? "Лучшее значение в строке" : undefined}
                                                        >
                                                            {isBest && !tone && <span aria-hidden>★ </span>}
                                                            {v}
                                                            {isBest && !tone && <span className="sr-only"> — лучшее значение</span>}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        );
                    })}

                    {renderFooter && (
                        <tbody>
                            <tr>
                                <td className={`${labelCell} bg-white dark:bg-slate-900`} />
                                {items.map((item) => (
                                    <td key={getId(item)} className={`px-3 py-3 align-top ${getId(item) === highlightId ? highlightCol : ""}`}>
                                        {renderFooter(item)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    )}
                </table>
            </div>

            {note && <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{note}</div>}
        </section>
    );
}
