import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import { toast } from "sonner";
import { isAuthenticated, projectsApi, type ProjectSummary } from "../api/projects.ts";
import { productPhotoUrl } from "../api/catalog.ts";
import { useProjectStore } from "../store/store";
import { useEconStore } from "../store/econStore";
import { paybackZone, roiZone, type Zone } from "../viz/economics";

const ZONE_STYLE: Record<Zone, string> = {
    green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    yellow: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const money = (v: string | null) =>
    v === null ? "—" : `${Math.round(Number(v)).toLocaleString("ru-RU")} ₽`;
const short = (v: string | null) => {
    if (v === null) return "—";
    const n = Number(v);
    return Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽` : money(v);
};

export function Calculations() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [items, setItems] = useState<ProjectSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const savedId = searchParams.get("saved");

    const setFormData = useProjectStore.setState;
    const setEcon = useEconStore.setState;
    const selectProduct = useProjectStore((s) => s.selectProduct);

    useEffect(() => {
        if (!isAuthenticated()) return;
        let alive = true;
        projectsApi
            .list()
            .then((r) => alive && setItems(r.items))
            .catch((err) => {
                if (!alive) return;
                setError(axios.isAxiosError(err) ? (err.response?.data?.message ?? err.message) : "Не удалось загрузить расчёты");
            });
        return () => {
            alive = false;
        };
    }, []);

    /** Открыть сохранённый расчёт: восстанавливаем обе формы и выбранного робота */
    const open = async (id: string) => {
        try {
            const p = await projectsApi.get(id);
            setFormData({ formData: p.params, selectedProductId: p.productId });
            if (p.econ) setEcon({ econ: p.econ });
            selectProduct(p.productId);
            navigate("/projects/result");
        } catch {
            toast.error("Не удалось открыть расчёт");
        }
    };

    const remove = async (id: string, name: string) => {
        if (!confirm(`Удалить расчёт «${name}»? Это действие нельзя отменить.`)) return;
        try {
            await projectsApi.remove(id);
            setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
            if (savedId === id) setSearchParams({});
            toast.success("Расчёт удалён");
        } catch {
            toast.error("Не удалось удалить расчёт");
        }
    };

    if (!isAuthenticated()) {
        return (
            <div className="mx-auto max-w-lg py-16 text-center">
                <h2 className="text-xl font-semibold tracking-tight">Расчёты сохраняются в аккаунте</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Войдите, чтобы сохранять результаты и возвращаться к ним позже.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                        Войти
                    </Link>
                    <Link to="/projects" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        Новый расчёт
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Мои расчёты</h2>
                    {items && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Сохранено: {items.length}. Каталог и версия модели фиксируются — расчёт воспроизводится позже.
                        </p>
                    )}
                </div>
                <Link to="/projects" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                    Новый расчёт
                </Link>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            )}

            {items === null && !error && (
                <div className="grid gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
                    ))}
                </div>
            )}

            {items?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Пока нет сохранённых расчётов. Пройдите визард и нажмите «Сохранить расчёт».
                    </p>
                    <Link to="/projects" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        Начать расчёт →
                    </Link>
                </div>
            )}

            <div className="grid gap-4">
                {items?.map((p) => {
                    const payback = p.paybackYears === null ? null : Number(p.paybackYears);
                    const pZone = paybackZone(payback);
                    const rZone = roiZone(p.roiPercent);
                    const photo = productPhotoUrl(p.product?.specs);
                    const isNew = savedId === p.id;

                    return (
                        <article
                            key={p.id}
                            className={`rounded-2xl border bg-white p-5 transition dark:bg-slate-900 ${
                                isNew ? "border-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-900/40" : "border-slate-200 dark:border-slate-800"
                            }`}
                        >
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    {photo ? (
                                        <img src={photo} alt="" className="h-full w-full object-contain p-1" />
                                    ) : (
                                        <span className="text-xs text-slate-400">нет фото</span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold">{p.name}</h3>
                                        {isNew && (
                                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                только что сохранён
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        {p.product?.name ?? "решение не выбрано"} · {p.robotsCount ?? "—"} роб. ·{" "}
                                        {new Date(p.updatedAt).toLocaleString("ru-RU")} · каталог v{p.catalogVersion} · модель {p.modelVersion}
                                    </p>

                                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                                        <div>
                                            <dt className="text-xs text-slate-500 dark:text-slate-400">CAPEX</dt>
                                            <dd className="font-medium tabular-nums">{short(p.capex)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-slate-500 dark:text-slate-400">Эффект / год</dt>
                                            <dd className="font-medium tabular-nums">{short(p.annualEffect)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-slate-500 dark:text-slate-400">Окупаемость</dt>
                                            <dd>
                                                <span className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${pZone ? ZONE_STYLE[pZone] : ""}`}>
                                                    {payback !== null ? `${payback} лет` : "—"}
                                                </span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-slate-500 dark:text-slate-400">ROI</dt>
                                            <dd>
                                                <span className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${rZone ? ZONE_STYLE[rZone] : ""}`}>
                                                    {p.roiPercent !== null ? `${p.roiPercent}%` : "—"}
                                                </span>
                                            </dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                                    <button
                                        type="button"
                                        onClick={() => open(p.id)}
                                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                    >
                                        Открыть
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(p.id, p.name)}
                                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
