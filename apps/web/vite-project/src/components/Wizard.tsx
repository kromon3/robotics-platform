import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, EffectCreative } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper";

import "swiper/css";
import "swiper/css/effect-creative";

export type SelectOption = { value: string; label: string };

export type WizardField<TName extends string = string> = {
    name: TName;
    label: string;
    type?: "text" | "number" | "select" | "checkbox";
    unit?: string;
    hint?: string;
    span?: "full";
};

export type WizardStep<TName extends string = string> = {
    icon: string;
    title: string;
    description?: string;
    columns: 1 | 2 | 3;
    fields: WizardField<TName>[];
    /** Произвольный блок под полями шага: сводка, пояснение, ссылка на другой экран */
    content?: ReactNode;
};

export type FieldLimit = { min: number; max: number };

type WizardProps<TName extends string> = {
    steps: WizardStep<TName>[];
    /** Текущее значение поля */
    getValue: (name: TName) => string | number | boolean;
    /** Один обработчик на все поля: читает event.target.name */
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    /** Варианты для type: "select" */
    getOptions?: (name: TName) => SelectOption[];
    /** Допустимый диапазон числового поля — подсказка под подписью и подсветка ошибки */
    getLimit?: (name: TName) => FieldLimit | undefined;
    intro: { icon: string; title: string; text: string; button: string };
    submitLabel: string;
    onSubmit: () => void;
    /** Шаг, на который перейти извне (например, после неуспешной валидации) */
    gotoStepRef?: React.MutableRefObject<((fieldName: TName) => void) | null>;
    header?: ReactNode;
};

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

const GRID_COLUMNS: Record<1 | 2 | 3, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
};

export function Wizard<TName extends string>({
    steps,
    getValue,
    onChange,
    getOptions,
    getLimit,
    intro,
    submitLabel,
    onSubmit,
    gotoStepRef,
    header,
}: WizardProps<TName>) {
    const swiperRef = useRef<SwiperClass | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const total = steps.length + 1;
    const isFirst = activeIndex === 0;
    const isLast = activeIndex === total - 1;

    // Наружу отдаём переход к слайду с нужным полем — для показа первой ошибки валидации.
    // Запись в ref только в эффекте: во время рендера React это запрещает.
    useEffect(() => {
        if (!gotoStepRef) return;
        gotoStepRef.current = (fieldName) => {
            const i = steps.findIndex((s) => s.fields.some((f) => f.name === fieldName));
            if (i >= 0) swiperRef.current?.slideTo(i + 1);
        };
        return () => {
            gotoStepRef.current = null;
        };
    }, [gotoStepRef, steps]);

    const renderField = (field: WizardField<TName>) => {
        const { name, label, type = "number", unit, hint, span } = field;
        const value = getValue(name);
        const limit = type === "number" ? getLimit?.(name) : undefined;
        const outOfRange = limit && typeof value === "number" && (value < limit.min || value > limit.max);

        if (type === "checkbox") {
            return (
                <label key={name} className={`flex items-center gap-2 ${span === "full" ? "col-span-full" : ""}`}>
                    <input
                        type="checkbox"
                        name={name}
                        checked={Boolean(value)}
                        onChange={onChange}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-700"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                    {hint && <span className="text-xs text-slate-400">{hint}</span>}
                </label>
            );
        }

        return (
            <label key={name} className={`block ${span === "full" ? "col-span-full" : ""}`}>
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {label}
                    {unit && <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">({unit})</span>}
                    {limit && (
                        <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">
                            {limit.min}–{limit.max}
                        </span>
                    )}
                </span>
                {type === "select" ? (
                    <select className={inputClass} name={name} value={String(value)} onChange={onChange}>
                        <option value="">— Выберите —</option>
                        {getOptions?.(name).map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        className={`${inputClass} ${outOfRange ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-700" : ""}`}
                        type={type}
                        name={name}
                        value={String(value)}
                        onChange={onChange}
                        min={type === "number" ? (limit?.min ?? 0) : undefined}
                        max={type === "number" ? limit?.max : undefined}
                        step={type === "number" ? "any" : undefined}
                        aria-invalid={outOfRange || undefined}
                    />
                )}
                {hint && <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
            </label>
        );
    };

    return (
        <div className="mx-auto w-full max-w-3xl">
            {header}
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
                    <SwiperSlide>
                        <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                            <div className="mb-5 text-6xl">{intro.icon}</div>
                            <h3 className="text-2xl font-bold tracking-tight">{intro.title}</h3>
                            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                {intro.text}
                            </p>
                            <button
                                type="button"
                                onClick={() => swiperRef.current?.slideNext()}
                                className={`${btnPrimaryClass} mt-6 px-6 py-2.5 text-base`}
                            >
                                {intro.button}
                            </button>
                        </div>
                    </SwiperSlide>

                    {steps.map((step) => (
                        <SwiperSlide key={step.title}>
                            <fieldset className="p-6 sm:p-8">
                                <legend className="mb-1 text-lg font-bold tracking-tight">
                                    <span className="mr-2">{step.icon}</span>
                                    {step.title}
                                </legend>
                                {step.description && (
                                    <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{step.description}</p>
                                )}
                                {step.fields.length > 0 && (
                                    <div className={`mt-4 grid gap-4 ${GRID_COLUMNS[step.columns]}`}>
                                        {step.fields.map(renderField)}
                                    </div>
                                )}
                                {step.content}
                            </fieldset>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* Прогресс и навигация */}
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
                <span className="min-w-14 text-sm text-slate-500 dark:text-slate-400">
                    {activeIndex + 1} / {total}
                </span>
                <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                        className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                        style={{ width: `${((activeIndex + 1) / total) * 100}%` }}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" className={btnSecondaryClass} disabled={isFirst} onClick={() => swiperRef.current?.slidePrev()}>
                        ← Назад
                    </button>
                    {isLast ? (
                        <button type="button" className={btnPrimaryClass} onClick={onSubmit}>
                            {submitLabel}
                        </button>
                    ) : (
                        <button type="button" className={btnPrimaryClass} onClick={() => swiperRef.current?.slideNext()}>
                            Далее →
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-4 flex justify-center gap-2">
                {Array.from({ length: total }, (_, i) => (
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
    );
}
