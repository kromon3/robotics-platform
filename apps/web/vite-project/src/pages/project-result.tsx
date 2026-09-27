import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import axios from "axios";
import { toast } from "sonner";
import type { ProductDetail } from "../api/catalog.ts";
import { isAuthenticated, projectsApi } from "../api/projects.ts";
import { computeScenario } from "../viz/economics";
import { getInvalidFields, getMissingFields, toNumericFormData, useProjectStore } from "../store/store";
import { toEconNumeric, useEconStore } from "../store/econStore";
import { toVizRobot } from "../viz/robotSpecs";
import { MODEL_VERSION, buildScenarios, toNorms, toSiteInput } from "../viz/adapter";
import { exportReportToExcel, printReport, type ReportMeta } from "../lib/report-export";
import { EconomicsReport } from "../components/EconomicsReport.tsx";
import { ScenarioView } from "../viz/core/ScenarioView";
import { ErrorBoundary } from "../viz/core/ErrorBoundary";
import "../viz/viz.css";

const API_URL = import.meta.env.VITE_API_URL;

type Tab = "report" | "simulation";

const btnSecondary =
    "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

// Откуда взяты ТТХ робота — попадает в шапку выгружаемого отчёта
const SPECS_SOURCE_LABEL: Record<string, string> = {
    specs: "каталог робототехников, данные производителя",
    v0: "габаритная таблица ТТХ v0",
    "type-default": "типовые значения по классу робота",
};

export function ProjectResult() {
    const navigate = useNavigate();
    const formData = useProjectStore((s) => s.formData);
    const productId = useProjectStore((s) => s.selectedProductId);
    const econ = useEconStore((s) => s.econ);
    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("report");
    const [saving, setSaving] = useState(false);

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

    const econNumeric = useMemo(() => toEconNumeric(econ), [econ]);
    const hasEcon = Boolean(econ.workMode);

    // Сценарии для схемы и имитации (компоненты warehouse-viz)
    const scenarios = useMemo(() => {
        if (!product) return null;
        return buildScenarios(toNumericFormData(formData), toVizRobot(product), hasEcon ? econNumeric : undefined);
    }, [product, formData, econNumeric, hasEcon]);

    // Входные данные экономической модели — для собственного отчёта
    const economics = useMemo(() => {
        if (!product) return null;
        const robot = toVizRobot(product);
        return {
            site: toSiteInput(toNumericFormData(formData), hasEcon ? econNumeric : undefined),
            robot: { name: robot.name, price: robot.price, throughputPerHour: robot.throughputPerHour },
            norms: toNorms(hasEcon ? econNumeric : undefined, undefined, toNumericFormData(formData)),
        };
    }, [product, formData, econNumeric, hasEcon]);

    // Шапка выгружаемого отчёта: что считали, чем и на каких данных (ТЗ 3.1.5, 3.7.3)
    const reportMeta = useMemo<ReportMeta | undefined>(() => {
        if (!product) return undefined;
        return {
            projectName: `Экспресс-оценка роботизации — ${product.name}`,
            robotName: `${product.name}${product.company?.name ? `, ${product.company.name}` : ""}`,
            objectType: "Склад",
            catalogVersion: product.catalogVersion,
            modelVersion: MODEL_VERSION,
            specsSource: SPECS_SOURCE_LABEL[toVizRobot(product).specsSource],
        };
    }, [product]);

    const downloadExcel = () => {
        if (!economics || !reportMeta) return;
        exportReportToExcel(economics.site, economics.robot, economics.norms, reportMeta);
        toast.success("Отчёт выгружен в Excel");
    };

    // Сохранение: вместе с исходными данными кладём итоги сценария «покупка» — список показывается без пересчёта
    const save = async () => {
        if (!economics || !product) return;
        if (!isAuthenticated()) {
            toast.error("Войдите, чтобы сохранить расчёт");
            navigate("/login");
            return;
        }
        setSaving(true);
        try {
            const buy = computeScenario("buy", economics.site, economics.robot, economics.norms);
            const created = await projectsApi.create({
                name: `${product.name} — ${new Date().toLocaleDateString("ru-RU")}`,
                params: formData,
                econ: hasEcon ? econ : undefined,
                norms: economics.norms as unknown as Record<string, unknown>,
                productId: product.id,
                robotsCount: buy.units,
                capex: Math.round(buy.capex),
                opexPerYear: Math.round(buy.opex),
                annualEffect: Math.round(buy.annualEffect),
                paybackYears: buy.paybackYears ?? undefined,
                roiPercent: buy.roi ?? undefined,
                tco: Math.round(buy.tco),
            });
            toast.success("Расчёт сохранён");
            navigate(`/calculations?saved=${created.id}`);
        } catch (err) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
            toast.error(Array.isArray(msg) ? msg.join("; ") : (msg ?? "Не удалось сохранить расчёт"));
        } finally {
            setSaving(false);
        }
    };

    if (!ready) return <Navigate to={productId ? "/projects/warehouse" : "/projects/offers"} replace />;

    const tabClass = (t: Tab) =>
        `rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === t
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        }`;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div>
                    <Link to="/projects/economics" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                        ← Изменить данные расчёта
                    </Link>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Расчёт{product ? `: ${product.name}` : ""}
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        title="Ставки ПО, интеграции, ПНР, ЗИП и подготовки пола — модельные допущения, заменяются данными КП"
                    >
                        Экономическая модель v2 · ставки — допущения
                    </span>
                    <button
                        type="button"
                        onClick={printReport}
                        disabled={!product || tab !== "report"}
                        title={tab === "report" ? "В диалоге печати выберите «Сохранить как PDF»" : "PDF выгружается со вкладки «Экономический отчёт»"}
                        className={btnSecondary}
                    >
                        Скачать PDF
                    </button>
                    <button type="button" onClick={downloadExcel} disabled={!product} className={btnSecondary}>
                        Скачать Excel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !product}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? "Сохранение…" : "Сохранить расчёт"}
                    </button>
                </div>
            </div>

            {!hasEcon && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    Расчёт выполнен на значениях демо-склада: режим работы, персонал и бюджет не заданы.{" "}
                    <Link to="/projects/economics" className="font-medium underline">
                        Ввести данные объекта
                    </Link>
                </div>
            )}

            <div className="flex gap-2 print:hidden">
                <button type="button" className={tabClass("report")} onClick={() => setTab("report")}>
                    Экономический отчёт
                </button>
                <button type="button" className={tabClass("simulation")} onClick={() => setTab("simulation")}>
                    Схема и имитация
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    Не удалось загрузить робота: {error}
                </div>
            )}

            {!product && !error && (
                <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
            )}

            {tab === "report" && economics && (
                <EconomicsReport site={economics.site} robot={economics.robot} norms={economics.norms} meta={reportMeta} />
            )}

            {tab === "simulation" && scenarios && (
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
