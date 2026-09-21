import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, EffectCreative } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper";
import {
    CARGO_TYPES,
    RACK_TYPES,
    getCargoOptions,
    getFieldValue,
    useProjectStore,
    type ProjectFieldName,
} from "../store/store";

import "swiper/css";
import "swiper/css/effect-creative";

type FieldConfig = {
    name: ProjectFieldName;
    label: string;
    type?: "text" | "number" | "select";
    unit?: string;
    span?: "full";
};

type Step = {
    icon: string;
    title: string;
    description?: string;
    columns: 1 | 2 | 3;
    fields: FieldConfig[];
};


const STEPS: Step[] = [
    {
        icon: "🏗️",
        title: "Основные параметры",
        columns: 2,
        fields: [
            { name: "rackType", label: "Тип стеллажей", type: "select", span: "full" },
            { name: "cargoType", label: "Тип груза", type: "select", span: "full" },
            { name: "width", label: "Ширина", unit: "м" },
            { name: "length", label: "Длина", unit: "м" },
            { name: "aisleWidth", label: "Ширина прохода", unit: "м" },
            { name: "workHours", label: "Рабочие часы", unit: "ч/день" },
        ],
    },
    {
        icon: "📊",
        title: "Мощности и вместимость",
        columns: 1,
        fields: [
            { name: "shelfCapacity", label: "Вместимость полки" },
            { name: "palletPlaces", label: "Паллетоместа" },
            { name: "oversizeShare", label: "Доля негабарита", unit: "%" },
        ],
    },
    {
        icon: "📐",
        title: "Габариты паллеты",
        description: "Длина × ширина × высота",
        columns: 3,
        fields: [
            { name: "pallet.L", label: "Длина (L)", unit: "мм" },
            { name: "pallet.W", label: "Ширина (W)", unit: "мм" },
            { name: "pallet.H", label: "Высота (H)", unit: "мм" },
        ],
    },
    {
        icon: "🏷️",
        title: "Параметры SKU",
        columns: 3,
        fields: [
            { name: "skuMass", label: "Масса SKU", unit: "кг", span: "full" },
            { name: "sku.L", label: "Длина (L)", unit: "мм" },
            { name: "sku.W", label: "Ширина (W)", unit: "мм" },
            { name: "sku.H", label: "Высота (H)", unit: "мм" },
            { name: "skuActive", label: "Активных SKU" },
            { name: "aClassShare", label: "Доля А-класса", unit: "%" },
        ],
    },
    {
        icon: "🔄",
        title: "Суточный товарооборот",
        columns: 2,
        fields: [
            { name: "receivePalletsDay", label: "Приёмка", unit: "паллет/день" },
            { name: "shipPalletsDay", label: "Отгрузка", unit: "паллет/день" },
            { name: "pickLinesDay", label: "Строк отбора", unit: "в день" },
            { name: "pickPiecesDay", label: "Штук отбора", unit: "в день" },
            { name: "piecePickShare", label: "Доля штучного отбора", unit: "%", span: "full" },
        ],
    },
];

const TOTAL_SLIDES = STEPS.length + 1;

const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 " +
    "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 " +
    "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";

const btnSecondaryClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition " +
    "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const btnPrimaryClass =
    "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition " +
    "hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40";

const GRID_COLUMNS: Record<Step["columns"], string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
};

// Варианты для селектов. Список груза зависит от выбранного стеллажа.
function useSelectOptions(name: ProjectFieldName) {
    const rackType = useProjectStore((state) => state.formData.rackType);
    if (name === "rackType") return RACK_TYPES;
    if (name === "cargoType") return getCargoOptions(rackType);
    return CARGO_TYPES;
}

function Field({ name, label, type = "number", unit, span }: FieldConfig) {
    const value = useProjectStore((state) => getFieldValue(state.formData, name));
    const handleChange = useProjectStore((state) => state.handleChange);
    const options = useSelectOptions(name);

    return (
        <label className={`block ${span === "full" ? "col-span-full" : ""}`}>
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {label}
                {unit && <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">({unit})</span>}
            </span>
            {type === "select" ? (
                <select className={inputClass} name={name} value={value} onChange={handleChange}>
                    <option value="">— Выберите —</option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    className={inputClass}
                    type={type}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    min={type === "number" ? 0 : undefined}
                    step={type === "number" ? "any" : undefined}
                />
            )}
        </label>
    );
}

export function Project() {
    const swiperRef = useRef<SwiperClass | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const reset = useProjectStore((state) => state.reset);

    const isFirst = activeIndex === 0;
    const isLast = activeIndex === TOTAL_SLIDES - 1;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Проекты</h2>
                <button
                    type="button"
                    onClick={reset}
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    Очистить форму
                </button>
            </div>

            <div className="mx-auto w-full max-w-3xl">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <Swiper
                        modules={[A11y, EffectCreative]}
                        onSwiper={(swiper) => (swiperRef.current = swiper)}
                        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                        slidesPerView={1}
                        autoHeight
                        // Свайп мешает выделять текст в инпутах — листаем только кнопками и точками
                        allowTouchMove={false}
                        effect="creative"
                        creativeEffect={{
                            prev: { shadow: true, translate: ["-20%", 0, -1], opacity: 0 },
                            next: { translate: ["100%", 0, 0] },
                        }}
                    >
                        {/* Приветствие */}
                        <SwiperSlide>
                            <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                                <div className="mb-5 text-6xl">📦</div>
                                <h3 className="text-2xl font-bold tracking-tight">Параметры склада</h3>
                                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                    Заполните параметры склада и складирования — по ним подберём подходящие
                                    роботизированные решения. Переходите между разделами кнопками или точками внизу.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => swiperRef.current?.slideNext()}
                                    className={`${btnPrimaryClass} mt-6 px-6 py-2.5 text-base`}
                                >
                                    Начать →
                                </button>
                            </div>
                        </SwiperSlide>

                        {STEPS.map((step) => (
                            <SwiperSlide key={step.title}>
                                <fieldset className="p-6 sm:p-8">
                                    <legend className="mb-1 text-lg font-bold tracking-tight">
                                        <span className="mr-2">{step.icon}</span>
                                        {step.title}
                                    </legend>
                                    {step.description && (
                                        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{step.description}</p>
                                    )}
                                    <div className={`mt-4 grid gap-4 ${GRID_COLUMNS[step.columns]}`}>
                                        {step.fields.map((field) => (
                                            <Field key={field.name} {...field} />
                                        ))}
                                    </div>
                                </fieldset>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                {/* Прогресс и навигация */}
                <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
                    <span className="min-w-14 text-sm text-slate-500 dark:text-slate-400">
                        {activeIndex + 1} / {TOTAL_SLIDES}
                    </span>
                    <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                            style={{ width: `${((activeIndex + 1) / TOTAL_SLIDES) * 100}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className={btnSecondaryClass}
                            disabled={isFirst}
                            onClick={() => swiperRef.current?.slidePrev()}
                        >
                            ← Назад
                        </button>
                        <button
                            type="button"
                            className={btnPrimaryClass}
                            disabled={isLast}
                            onClick={() => swiperRef.current?.slideNext()}
                        >
                            Далее →
                        </button>
                    </div>
                </div>

                {/* Точки-индикаторы */}
                <div className="mt-4 flex justify-center gap-2">
                    {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
                        <button
                            key={i}
                            type="button"
                            aria-label={`Шаг ${i + 1}`}
                            onClick={() => swiperRef.current?.slideTo(i)}
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                                activeIndex === i
                                    ? "w-6 bg-indigo-600"
                                    : "w-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
