import { useSearchParams } from "react-router";
import { useCallback, useMemo } from "react";

export interface CatalogFilters {
    search: string;
    type: string;        // brs | bas | software
    category: string;
    status: string;      // operation | piloting | rnd
    sort: string;        // price_asc | price_desc | ugt_desc | new
    page: number;
}

const DEFAULTS: CatalogFilters = {
    search: "",
    type: "",
    category: "",
    status: "",
    sort: "",
    page: 1,
};

export function useCatalogFilters() {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = useMemo<CatalogFilters>(() => ({
        search: searchParams.get("search") ?? "",
        type: searchParams.get("type") ?? "",
        category: searchParams.get("category") ?? "",
        status: searchParams.get("status") ?? "",
        sort: searchParams.get("sort") ?? "",
        page: Math.max(1, Number(searchParams.get("page")) || 1),
    }), [searchParams]);

    // Обновление одного или нескольких фильтров.
    // При смене фильтра (не page) — сбрасываем страницу на 1.
    const setFilter = useCallback(
        (patch: Partial<CatalogFilters>) => {
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);

                const resetsPage = !("page" in patch);

                Object.entries(patch).forEach(([key, value]) => {
                    const isEmpty =
                        value === "" || value === null || value === undefined || value === DEFAULTS[key as keyof CatalogFilters];

                    if (isEmpty) params.delete(key);
                    else params.set(key, String(value));
                });

                if (resetsPage) params.delete("page");

                return params;
            }, { replace: true });
        },
        [setSearchParams]
    );

    const resetFilters = useCallback(() => {
        setSearchParams({}, { replace: true });
    }, [setSearchParams]);

    const goToPage = useCallback(
        (next: number) => {
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                if (next <= 1) params.delete("page");
                else params.set("page", String(next));
                return params;
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [setSearchParams]
    );

    const activeCount = useMemo(
        () => [filters.search, filters.type, filters.category, filters.status].filter(Boolean).length,
        [filters]
    );

    return { filters, setFilter, resetFilters, goToPage, activeCount };
}