import { useEffect, useState } from "react";
import axios from "axios";
import { RobotCard } from "../components/RobotCard.tsx";
import { Pagination } from "../components/Pagination.tsx";
import { CatalogFilters } from "../components/CatalogFilters.tsx";
import { useCatalogFilters } from "../hooks/useCatalogFilters.ts";
import type { ProductsResponse } from "../api/catalog.ts";

const API_URL = import.meta.env.VITE_API_URL;
const LIMIT = 20;

export function Robots() {
    const { filters, setFilter, resetFilters, goToPage, activeCount } = useCatalogFilters();
    const { page } = filters;

    const [data, setData] = useState<ProductsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get<ProductsResponse>(
                    `${API_URL}/catalog/products`,
                    {
                        params: {
                            page,
                            limit: LIMIT,
                            // в URL страницы параметр называется search, бэкенд ждёт q
                            q: filters.search || undefined,
                            type: filters.type || undefined,
                            category: filters.category || undefined,
                            status: filters.status || undefined,
                            sort: filters.sort || undefined,
                        },
                        signal: controller.signal,
                    }
                );
                setData(response.data);
            } catch (err) {
                if (axios.isCancel(err)) return;
                setError(err instanceof Error ? err.message : "Что-то пошло не так");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, [page, filters.search, filters.type, filters.category, filters.status, filters.sort]);

    if (error)
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <p className="font-medium">Не удалось загрузить каталог</p>
                <p className="mt-1 text-sm">{error}</p>
            </div>
        );

    const items = data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Каталог решений</h2>
                {data && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {data.total} решений
                    </span>
                )}
            </div>

            <CatalogFilters
                filters={filters}
                onChange={setFilter}
                onReset={resetFilters}
                activeCount={activeCount}
            />

            <div
                className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                    loading ? "pointer-events-none opacity-50" : ""
                }`}
            >
                {loading && !data
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
                        />
                    ))
                    : items.map((item) => <RobotCard key={item.id} item={item} />)}
            </div>

            {data && data.total === 0 && (
                <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Ничего не найдено
                </p>
            )}

            {data && (
                <Pagination
                    page={page}
                    pages={data.pages}
                    total={data.total}
                    limit={data.limit}
                    onChange={goToPage}
                />
            )}
        </div>
    );
}