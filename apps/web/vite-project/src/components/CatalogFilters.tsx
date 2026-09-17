import { useEffect, useState } from "react";
import type { CatalogFilters } from "../hooks/useCatalogFilters";

interface Props {
    filters: CatalogFilters;
    onChange: (patch: Partial<CatalogFilters>) => void;
    onReset: () => void;
    activeCount: number;
}

// brs — беспилотные роботизированные системы (в т.ч. морские), bas — беспилотные авиационные
const TYPES = [
    { value: "brs", label: "Роботы (БРС)" },
    { value: "bas", label: "Дроны (БАС)" },
    { value: "software", label: "ПО" },
];

// Значения из каталога организатора; когда появится GET /catalog/facets — брать оттуда
const CATEGORIES = [
    "Мобильные роботы",
    "Морские роботы",
    "Автономные наземные транспортные средства",
    "Стационарные роботизированные системы",
    "Роботы-манипуляторы",
    "Антропоморфные роботы",
    "Мобильные манипуляторы",
    "БАС",
    "ПО БРС",
    "ПО",
    "Другое",
];

const STATUSES = [
    { value: "operation", label: "В эксплуатации" },
    { value: "piloting", label: "Пилотирование" },
    { value: "rnd", label: "НИОКР" },
];

const SORTS = [
    { value: "", label: "По умолчанию" },
    { value: "price_asc", label: "Цена ↑" },
    { value: "price_desc", label: "Цена ↓" },
    { value: "ugt_desc", label: "УГТ ↓" },
];

export function CatalogFilters({ filters, onChange, onReset, activeCount }: Props) {
    // Локальный стейт для поиска с дебаунсом
    const [search, setSearch] = useState(filters.search);

    // Синхронизация, если URL изменился извне (кнопка «Сбросить», навигация назад).
    // Не через useEffect (react-hooks/set-state-in-effect), а паттерном «сброс при смене пропа»:
    // setState во время рендера React перезапускает рендер сразу, без лишнего кадра.
    const [syncedSearch, setSyncedSearch] = useState(filters.search);
    if (filters.search !== syncedSearch) {
        setSyncedSearch(filters.search);
        setSearch(filters.search);
    }

    useEffect(() => {
        const t = setTimeout(() => {
            if (search !== filters.search) onChange({ search });
        }, 400);
        return () => clearTimeout(t);
    }, [search, filters.search, onChange]);

    const selectClass =
        "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 " +
        "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 " +
        "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            {/* Поиск */}
            <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию…"
                className={`${selectClass} min-w-52 flex-1`}
            />

            {/* Тип */}
            <select
                value={filters.type}
                onChange={(e) => onChange({ type: e.target.value })}
                className={selectClass}
            >
                <option value="">Все типы</option>
                {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                ))}
            </select>

            {/* Категория */}
            <select
                value={filters.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className={selectClass}
            >
                <option value="">Все категории</option>
                {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                ))}
            </select>

            {/* Статус */}
            <select
                value={filters.status}
                onChange={(e) => onChange({ status: e.target.value })}
                className={selectClass}
            >
                <option value="">Любой статус</option>
                {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
            </select>

            {/* Сортировка */}
            <select
                value={filters.sort}
                onChange={(e) => onChange({ sort: e.target.value })}
                className={selectClass}
            >
                {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
            </select>

            {/* Сброс */}
            {activeCount > 0 && (
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                    Сбросить ({activeCount})
                </button>
            )}
        </div>
    );
}