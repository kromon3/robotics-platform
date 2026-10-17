import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { PRODUCT_STATUS_LABELS, productPhotoUrl, type Product, type ProductStatus } from "../api/catalog.ts";
import { toVizRobot, type VizRobot } from "../viz/robotSpecs";
import type { ScorePart } from "../viz/ranking";
import { COMPARE_LIMIT, NO_DATA } from "../lib/compare";
import { cardSpecs, formatPrice, formatSourceDate, specText, specsSourceLabel, trustLabel, type SpecMode } from "../lib/product-compare";
import { ScoreBadge, ScoreBreakdown } from "./ScoreBreakdown.tsx";

// Карточка решения — одна для каталога «Роботы» и витрины подбора.
// Одна поверхность и четыре яруса: 1) кто это — фото, название, производитель, цена;
// 2) ключевые характеристики; 3) служебное — источник и надёжность данных (на витрине — оценка
// подбора с разбором); 4) действия. Служебный ярус и действия прижаты к низу (mt-auto),
// заголовок и описание фиксированной высоты — карточки в ряду одной высоты и выровнены.

const statusStyles: Record<ProductStatus, string> = {
    operation: "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
    piloting: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    rnd: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
};

type Props = {
    item: Product;
    /** catalog — заявленные ТТХ без объекта; showcase — значения модели, с которыми идёт расчёт */
    variant?: "catalog" | "showcase";
    /** Модель робота (витрина её уже посчитала); в каталоге вычисляется сама */
    robot?: VizRobot;
    /** Отметка «Сравнить»; full — набор полон, отметка новой покажет сообщение о лимите */
    compare?: { checked: boolean; full: boolean; onToggle: () => void };
    /** Оценка подбора — только на витрине */
    score?: { score: number; rank: number; parts: ScorePart[] };
    /** Дополнительная характеристика, зависящая от объекта (например, нужный проход) */
    extraSpec?: { label: string; value: string };
    /** Действия вместо «Подробнее» (витрина: «Выбрать для расчёта») */
    actions?: ReactNode;
};

const divider = "border-t border-slate-100 pt-3 dark:border-slate-800";

export function RobotCard({ item, variant = "catalog", robot, compare, score, extraSpec, actions }: Props) {
    const { id, name, subtype, category, description, status, company, verified, sourceDate, ugt } = item;
    const mode: SpecMode = variant === "showcase" ? "model" : "declared";
    const model = useMemo(() => robot ?? toVizRobot(item), [robot, item]);
    const compareItem = { product: item, robot: model };

    const specs = cardSpecs(compareItem, mode);
    const noSpecs = specs.every((s) => s.value === null);
    const manufacturer = company?.name ?? specText(item, "manufacturer");
    // subtype бывает null — без фильтра рендерится « · Категория» с висящей точкой
    const subtitle = [subtype, category].filter(Boolean).join(" · ");
    const date = formatSourceDate(sourceDate);
    const note = specText(item, "note");
    const photo = productPhotoUrl(item.specs);
    const href = `/robots/${id}`;
    const checked = compare?.checked ?? false;

    return (
        <article
            className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:bg-slate-900 dark:text-slate-100 ${
                checked
                    ? "border-indigo-400 ring-2 ring-indigo-200 dark:border-indigo-600 dark:ring-indigo-900"
                    : "border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-700"
            }`}
        >
            {/* Фото: фиксированные пропорции, contain — снимки разных пропорций не ломают сетку.
                Ссылка дублирует заголовок, поэтому убрана из порядка табуляции. */}
            <Link to={href} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                {photo ? (
                    <img src={photo} alt="" loading="lazy" className="h-full w-full object-contain p-3" />
                ) : (
                    <span className="flex h-full items-center justify-center">
                        <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="8" width="18" height="12" rx="2" />
                            <path d="M12 4v4M8 14h.01M16 14h.01M9 18h6" />
                        </svg>
                    </span>
                )}
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
                    {PRODUCT_STATUS_LABELS[status]}
                </span>
            </Link>

            <div className="flex flex-1 flex-col gap-3 p-4">
                {/* 1. Кто это: название, производитель, описание, цена */}
                <div className="flex flex-col">
                    <h3 className="line-clamp-2 min-h-[2.75rem] break-words text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
                        <Link to={href} className="rounded hover:text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">
                            {name}
                        </Link>
                    </h3>
                    <p className="mt-0.5 min-h-4 truncate text-xs font-medium text-slate-600 dark:text-slate-300" title={manufacturer ?? undefined}>
                        {manufacturer ?? " "}
                        {company?.region && <span className="font-normal text-slate-400 dark:text-slate-500"> · {company.region}</span>}
                    </p>
                    <p className="min-h-4 truncate text-xs text-slate-400 dark:text-slate-500" title={subtitle}>
                        {subtitle || " "}
                    </p>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-600 dark:text-slate-300" title={description ?? undefined}>
                        {description ?? <span className="text-slate-400 dark:text-slate-500">Описание не указано</span>}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatPrice(item.price)}</p>
                </div>

                {/* 2. Ключевые характеристики */}
                {noSpecs && !extraSpec ? (
                    <p className={`${divider} text-xs text-slate-400 dark:text-slate-500`}>
                        Производитель не заявил ТТХ — смотрите описание и источник данных.
                    </p>
                ) : (
                    <dl className={`${divider} grid grid-cols-2 gap-x-3 gap-y-2 text-xs`}>
                        {[...specs, ...(extraSpec ? [extraSpec] : [])].map((s) => (
                            <div key={s.label} className="min-w-0">
                                <dt className="truncate text-slate-500 dark:text-slate-400" title={s.label}>{s.label}</dt>
                                <dd
                                    className={`truncate tabular-nums ${s.value === null ? "italic text-slate-400 dark:text-slate-500" : "font-medium text-slate-800 dark:text-slate-200"}`}
                                    title={s.value ?? NO_DATA}
                                >
                                    {s.value ?? NO_DATA}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}

                {/* 3. Служебное: откуда данные и насколько им доверять; на витрине — оценка подбора */}
                <div className={`${divider} mt-auto flex flex-col gap-1.5 text-[11px] text-slate-500 dark:text-slate-400`}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                                verified
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                            title="Достоверность данных"
                        >
                            {verified ? "✓ " : ""}
                            {trustLabel(verified)}
                        </span>
                        {date && <span title="Дата данных">от {date}</span>}
                        {ugt && <span title="Уровень готовности технологии">УГТ {ugt}/9</span>}
                    </div>
                    <p className="truncate" title={specsSourceLabel(compareItem, mode)}>
                        Источник ТТХ: {specsSourceLabel(compareItem, mode)}
                    </p>
                    {note && (
                        <p className="line-clamp-1 text-amber-700 dark:text-amber-400" title={note}>
                            ⚠ {note}
                        </p>
                    )}
                    {score && (
                        <div className="mt-1">
                            <ScoreBadge score={score.score} rank={score.rank} />
                            <ScoreBreakdown parts={score.parts} />
                        </div>
                    )}
                </div>

                {/* 4. Действия */}
                <div className={`${divider} flex flex-col gap-2`}>
                    {compare && (
                        <div className="flex items-center justify-between gap-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={compare.onToggle}
                                    aria-label={`Сравнить: ${name}`}
                                    aria-describedby={compare.full && !checked ? `${id}-compare-limit` : undefined}
                                    className={`h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-700 ${
                                        compare.full && !checked ? "opacity-50" : ""
                                    }`}
                                />
                                Сравнить
                                {compare.full && !checked && (
                                    // Видимое сообщение о лимите — в тосте и на плашке сравнения; здесь — для скринридера
                                    <span id={`${id}-compare-limit`} className="sr-only">
                                        Уже выбрано {COMPARE_LIMIT} из {COMPARE_LIMIT}, сначала уберите одно из выбранных
                                    </span>
                                )}
                            </label>
                            {!actions && (
                                <Link to={href} className="whitespace-nowrap text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                    Подробнее →
                                </Link>
                            )}
                        </div>
                    )}
                    {actions ??
                        (!compare && (
                            <Link to={href} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                Подробнее →
                            </Link>
                        ))}
                </div>
            </div>
        </article>
    );
}
