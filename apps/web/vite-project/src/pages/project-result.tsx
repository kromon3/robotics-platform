import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import axios from "axios";
import type { ProductDetail } from "../api/catalog.ts";
import { getInvalidFields, getMissingFields, toNumericFormData, useProjectStore } from "../store/store";
import { toVizRobot } from "../viz/robotSpecs";
import { buildScenarios } from "../viz/adapter";
import { ScenarioView } from "../viz/core/ScenarioView";
import { ErrorBoundary } from "../viz/core/ErrorBoundary";
import "../viz/viz.css";

const API_URL = import.meta.env.VITE_API_URL;

export function ProjectResult() {
    const formData = useProjectStore((s) => s.formData);
    const productId = useProjectStore((s) => s.selectedProductId);
    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    const ready = getMissingFields(formData).length === 0 && getInvalidFields(formData).length === 0 && !!productId;

    useEffect(() => {
        if (!ready) return;
        const controller = new AbortController();
        axios
            .get<ProductDetail>(`${API_URL}/catalog/products/${productId}`, { signal: controller.signal })
            .then((r) => setProduct(r.data))
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setError(err instanceof Error ? err.message : "Что-то пошло не так");
            });
        return () => controller.abort();
    }, [ready, productId]);

    // Сценарии пересобираются только при смене параметров или робота
    const scenarios = useMemo(() => {
        if (!product) return null;
        return buildScenarios(toNumericFormData(formData), toVizRobot(product));
    }, [product, formData]);

    if (!ready) return <Navigate to={productId ? "/projects" : "/projects/offers"} replace />;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <Link to="/projects/offers" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                        ← Выбрать другого робота
                    </Link>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Расчёт{product ? `: ${product.name}` : ""}
                    </h2>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Экономика v0 — нормативы-допущения
                </span>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    Не удалось загрузить робота: {error}
                </div>
            )}

            {!scenarios && !error && (
                <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
            )}

            {scenarios && (
                // .viz — область стилей визуализации (viz.css), внутри — компоненты warehouse-viz как есть
                <div className="viz">
                    <ErrorBoundary>
                        <ScenarioView scenarios={scenarios} />
                    </ErrorBoundary>
                </div>
            )}
        </div>
    );
}
