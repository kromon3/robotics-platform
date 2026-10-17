import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Product } from "../api/catalog.ts";
import { COMPARE_LIMIT, toggleCompareId, type ToggleStatus } from "../lib/compare";

// Выбор решений для сравнения в каталоге «Роботы». Гостю вход не нужен.
// Хранится в sessionStorage: переживает переходы по каталогу, страницы, фильтры и F5,
// но не тянется в следующий визит. Продукты кэшируем, чтобы показать выбранные
// с других страниц каталога без повторной загрузки.

type CompareState = {
    ids: string[];
    products: Record<string, Product>;
    /** Строка поиска каталога (?search=…&page=…), чтобы из сравнения вернуться туда же */
    catalogSearch: string;
    toggle: (product: Product) => ToggleStatus;
    remove: (id: string) => void;
    clear: () => void;
    /** Набор из ссылки ?ids= — например, если сравнением поделились */
    setIds: (ids: string[]) => void;
    remember: (products: Product[]) => void;
    setCatalogSearch: (search: string) => void;
};

export const useCompareStore = create<CompareState>()(
    persist(
        (set, get) => ({
            ids: [],
            products: {},
            catalogSearch: "",
            toggle: (product) => {
                const { ids, status } = toggleCompareId(get().ids, product.id, COMPARE_LIMIT);
                if (status === "added") set((s) => ({ ids, products: { ...s.products, [product.id]: product } }));
                else if (status === "removed") set({ ids });
                return status;
            },
            remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
            clear: () => set({ ids: [] }),
            setIds: (ids) => set({ ids: ids.slice(0, COMPARE_LIMIT) }),
            remember: (products) =>
                set((s) => ({ products: { ...s.products, ...Object.fromEntries(products.map((p) => [p.id, p])) } })),
            setCatalogSearch: (catalogSearch) => set({ catalogSearch }),
        }),
        {
            name: "catalog-compare",
            storage: createJSONStorage(() => sessionStorage),
            // Кэш продуктов храним только для выбранных — иначе sessionStorage разрастается
            partialize: (s) => ({
                ids: s.ids,
                catalogSearch: s.catalogSearch,
                products: Object.fromEntries(s.ids.filter((id) => s.products[id]).map((id) => [id, s.products[id]])),
            }),
        },
    ),
);
