type PaginationProps = {
    page: number;
    pages: number;
    total: number;
    limit: number;
    onChange: (page: number) => void;
};

const btnClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition " +
    "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export function Pagination({ page, pages, total, limit, onChange }: PaginationProps) {
    if (total === 0) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Показано <span className="font-medium text-slate-700 dark:text-slate-200">{from}–{to}</span> из{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span>
            </p>
            <div className="flex items-center gap-2">
                <button type="button" className={btnClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>
                    ← Назад
                </button>
                <span className="px-2 text-sm text-slate-600 dark:text-slate-300">
                    {page} / {pages}
                </span>
                <button type="button" className={btnClass} disabled={page >= pages} onClick={() => onChange(page + 1)}>
                    Вперёд →
                </button>
            </div>
        </div>
    );
}
