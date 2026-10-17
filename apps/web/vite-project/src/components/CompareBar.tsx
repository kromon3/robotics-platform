import { COMPARE_LIMIT, COMPARE_MIN } from "../lib/compare";

// Плашка сравнения внизу экрана: сколько выбрано, «Сравнить» и «Сбросить».
// Общая для каталога и витрины подбора. Сообщения (например, о лимите) читаются скринридером.

type Props = {
    /** Выбранные решения — названия показываем чипами, у каждого можно снять отметку */
    selected: { id: string; name: string }[];
    onCompare: () => void;
    onClear: () => void;
    onRemove?: (id: string) => void;
    compareLabel?: string;
    /** Сообщение для пользователя: «можно сравнить не больше трёх» */
    message?: string | null;
};

export function CompareBar({ selected, onCompare, onClear, onRemove, compareLabel = "Сравнить", message }: Props) {
    if (selected.length === 0) return null;
    const ready = selected.length >= COMPARE_MIN;
    const full = selected.length >= COMPARE_LIMIT;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 print:hidden lg:pl-64">
            <div
                role="region"
                aria-label="Сравнение решений"
                className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    К сравнению: {selected.length} из {COMPARE_LIMIT}
                </span>

                {onRemove && (
                    <ul className="hidden max-w-xl flex-wrap gap-1.5 md:flex">
                        {selected.map((s) => (
                            <li
                                key={s.id}
                                className="flex max-w-[12rem] items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <span className="truncate" title={s.name}>
                                    {s.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onRemove(s.id)}
                                    aria-label={`Убрать ${s.name} из сравнения`}
                                    className="rounded-full px-1 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                    {message ?? (ready ? (full ? "максимум выбран" : "") : "отметьте ещё одно решение")}
                </span>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onCompare}
                        disabled={!ready}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {compareLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Сбросить
                    </button>
                </div>
            </div>
        </div>
    );
}
