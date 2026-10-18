import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { Product } from "../api/catalog.ts";
import { useCompareStore } from "../store/compareStore.ts";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Решения каталога по списку id — для сравнения и запроса КП. Берёт из кэша выбора
 * (compareStore), недостающие (ссылка из другого браузера) догружает по одному и кэширует.
 * Порядок — как в ids.
 */
export function useProductsByIds(ids: string[]) {
    const cache = useCompareStore((s) => s.products);
    const remember = useCompareStore((s) => s.remember);
    // Ошибка привязана к набору, который грузили: сменился набор — старая ошибка не показывается
    const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

    const missing = ids.filter((id) => !cache[id]);
    const missingKey = missing.join(",");
    useEffect(() => {
        if (!missingKey) return;
        const controller = new AbortController();
        Promise.all(
            missingKey
                .split(",")
                .map((id) => axios.get<Product>(`${API_URL}/catalog/products/${id}`, { signal: controller.signal }).then((r) => r.data)),
        )
            .then(remember)
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setFailed({ key: missingKey, message: err instanceof Error ? err.message : "Что-то пошло не так" });
            });
        return () => controller.abort();
    }, [missingKey, remember]);

    const error = failed && failed.key === missingKey ? failed.message : null;
    const products = useMemo(() => ids.filter((id) => cache[id]).map((id) => cache[id]), [ids, cache]);

    return { products, loading: missing.length > 0 && !error, error };
}
