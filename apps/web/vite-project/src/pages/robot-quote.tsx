import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import axios from "axios";
import { isAuthenticated } from "../api/projects.ts";
import { quotesApi, type QuoteReceipt, type QuoteSource } from "../api/quotes.ts";
import { useProductsByIds } from "../hooks/useProductsByIds.ts";
import { parseCompareIds, serializeCompareIds } from "../lib/compare";
import { formatPrice } from "../lib/product-compare";
import {
    EMPTY_QUOTE_FORM,
    QUOTE_COMMENT_MAX,
    QUOTE_MAX_QUANTITY,
    QUOTE_TIMEFRAMES,
    buildQuotePayload,
    errorCount,
    formatQuoteNumber,
    groupLinesBySupplier,
    hasErrors,
    linesFromProducts,
    plural,
    positionsLabel,
    quoteErrorMessage,
    validateQuoteForm,
    type QuoteErrors,
    type QuoteField,
    type QuoteFormValues,
} from "../lib/quote-form";

// «Запросить КП» — последний шаг сценария снабженца: каталог → сравнение 2–3 решений → запрос
// коммерческих предложений. Работает для гостя. Решения приходят в адресе (?ids=…&source=…):
// из сравнения — все выбранные (из колонки — все, но отмечено одно), со страницы решения — одно. Позиции раскладываются по поставщикам,
// каждый получит только свою часть.

/** Больше позиций бэкенд не примет (QUOTE_MAX_ITEMS) */
const MAX_ITEMS = 10;

const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 " +
    "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 " +
    "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
const invalidClass = "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-700";
const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const sectionTitleClass = "mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const primaryBtn =
    "rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
    "rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";

// Порядок полей — для фокуса на первой ошибке
const FIELD_ORDER: (QuoteField | "lines")[] = [
    "lines",
    "contactName",
    "company",
    "email",
    "phone",
    "inn",
    "deliveryRegion",
    "timeframe",
    "comment",
    "consent",
];
const fieldId = (name: string) => `quote-${name}`;

type Selection = Record<string, { selected?: boolean; quantity?: string }>;

export function RobotQuote() {
    const [searchParams] = useSearchParams();
    const ids = useMemo(() => parseCompareIds(searchParams.get("ids"), MAX_ITEMS), [searchParams]);
    const source: QuoteSource | undefined =
        searchParams.get("source") === "detail" ? "detail" : searchParams.get("source") === "compare" ? "compare" : undefined;
    // ?selected=<id> — открыли из колонки сравнения: остальные решения видны, но не отмечены
    const preselected = searchParams.get("selected");
    const { products, loading, error: loadError } = useProductsByIds(ids);

    // Отметки и количества — поверх списка решений, чтобы не дублировать его в состоянии
    const [selection, setSelection] = useState<Selection>({});
    const lines = useMemo(
        () =>
            linesFromProducts(products).map((l) => ({
                ...l,
                selected:
                    selection[l.productId]?.selected ??
                    (preselected && ids.includes(preselected) ? l.productId === preselected : l.selected),
                quantity: selection[l.productId]?.quantity ?? l.quantity,
            })),
        [products, selection, preselected, ids],
    );
    const setLine = (id: string, patch: { selected?: boolean; quantity?: string }) =>
        setSelection((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

    const [values, setValues] = useState<QuoteFormValues>(EMPTY_QUOTE_FORM);
    const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

    // Вошедшему пользователю подставляем имя и email — только в пустые поля
    useEffect(() => {
        if (!isAuthenticated()) return;
        const controller = new AbortController();
        quotesApi
            .me(controller.signal)
            .then((user) =>
                setValues((v) => ({
                    ...v,
                    contactName: v.contactName || user.name,
                    email: v.email || user.email,
                })),
            )
            .catch(() => {
                // Токен протух — заполнит сам, как гость
            });
        return () => controller.abort();
    }, []);

    // Ошибки показываем после первой попытки отправить и дальше — по мере правки
    const [submitted, setSubmitted] = useState(false);
    const errors: QuoteErrors = submitted ? validateQuoteForm(values, lines) : {};
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<QuoteReceipt | null>(null);
    const summaryRef = useRef<HTMLDivElement>(null);

    const groups = groupLinesBySupplier(lines);
    const backTo =
        source === "detail" && ids[0]
            ? `/robots/${ids[0]}`
            : ids.length > 0
              ? `/robots/compare?ids=${encodeURIComponent(serializeCompareIds(ids))}`
              : "/robots";
    const backLabel = source === "detail" ? "← К решению" : source === "compare" ? "← К сравнению" : "← Назад";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        setSendError(null);
        const found = validateQuoteForm(values, lines);
        if (hasErrors(found)) {
            // Фокус — на первое поле с ошибкой; сводка над формой читается скринридером
            const first = FIELD_ORDER.find((f) => (f === "lines" ? found.lines || found.quantities : found[f]));
            const target =
                first === "lines" && found.quantities
                    ? document.getElementById(fieldId(`qty-${Object.keys(found.quantities)[0]}`))
                    : document.getElementById(fieldId(first ?? "contactName"));
            summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            target?.focus({ preventScroll: true });
            return;
        }
        setSending(true);
        try {
            setReceipt(await quotesApi.create(buildQuotePayload(values, lines, source)));
            window.scrollTo({ top: 0 });
        } catch (err) {
            const response = axios.isAxiosError(err) ? err.response : undefined;
            const data = response?.data as { message?: string | string[] } | undefined;
            setSendError(quoteErrorMessage(response ? { status: response.status, message: data?.message } : null));
        } finally {
            setSending(false);
        }
    };

    if (receipt) return <QuoteSuccess receipt={receipt} backTo={backTo} />;

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div>
                <Link
                    to={backTo}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                    {backLabel}
                </Link>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Запрос коммерческого предложения</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                    Укажите, сколько решений нужно, куда и когда поставить. Платформа передаст запрос поставщикам — каждому только его
                    позиции и ваши контакты. Регистрация не нужна.
                </p>
            </div>

            {loadError && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                    <p className="font-medium">Не удалось загрузить решения для запроса</p>
                    <p className="mt-1 text-sm">{loadError}</p>
                </div>
            )}

            {loading && (
                <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
            )}

            {!loading && !loadError && products.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    Решения для запроса не выбраны. Отметьте «Сравнить» у нужных решений в каталоге или откройте карточку решения.
                    <div className="mt-3">
                        <Link to="/robots" className={`inline-block ${primaryBtn}`}>
                            Перейти в каталог
                        </Link>
                    </div>
                </div>
            )}

            {!loading && products.length > 0 && (
                <form noValidate onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
                    <div className="flex flex-col gap-6">
                        <div ref={summaryRef} className="scroll-mt-4" aria-live="assertive">
                            {submitted && hasErrors(errors) && (
                                <div
                                    role="alert"
                                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                >
                                    Проверьте форму: {errorCount(errors)}{" "}
                                    {plural(errorCount(errors), ["поле требует", "поля требуют", "полей требуют"])} исправления — они
                                    отмечены красным.
                                </div>
                            )}
                        </div>

                        {/* Позиции: какие решения и сколько */}
                        <fieldset className={sectionClass} aria-describedby={errors.lines ? fieldId("lines-error") : undefined}>
                            <legend className="sr-only">Решения и количество</legend>
                            <h3 className={sectionTitleClass}>Что запросить</h3>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {lines.map((line, idx) => {
                                    const qtyError = errors.quantities?.[line.productId];
                                    return (
                                        <li key={line.productId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                                            <input
                                                id={idx === 0 ? fieldId("lines") : undefined}
                                                type="checkbox"
                                                checked={line.selected}
                                                onChange={(e) => setLine(line.productId, { selected: e.target.checked })}
                                                aria-label={`Запросить КП: ${line.name}`}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-700"
                                            />
                                            <div className={`min-w-0 flex-1 ${line.selected ? "" : "opacity-50"}`}>
                                                <Link
                                                    to={`/robots/${line.productId}`}
                                                    className="block truncate text-sm font-semibold hover:underline"
                                                >
                                                    {line.name}
                                                </Link>
                                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                    {line.supplierName} · {formatPrice(line.price)}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <label
                                                    className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400"
                                                    htmlFor={fieldId(`qty-${line.productId}`)}
                                                >
                                                    Количество, шт
                                                    <input
                                                        id={fieldId(`qty-${line.productId}`)}
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={1}
                                                        max={QUOTE_MAX_QUANTITY}
                                                        step={1}
                                                        value={line.quantity}
                                                        disabled={!line.selected}
                                                        onChange={(e) => setLine(line.productId, { quantity: e.target.value })}
                                                        aria-invalid={qtyError ? true : undefined}
                                                        aria-describedby={qtyError ? fieldId(`qty-${line.productId}-error`) : undefined}
                                                        className={`${inputClass} w-24 tabular-nums disabled:opacity-50 ${qtyError ? invalidClass : ""}`}
                                                    />
                                                </label>
                                                {qtyError && (
                                                    <span
                                                        id={fieldId(`qty-${line.productId}-error`)}
                                                        className="mt-1 text-xs text-red-600 dark:text-red-400"
                                                    >
                                                        {qtyError}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            {errors.lines && (
                                <p id={fieldId("lines-error")} className="mt-3 text-xs text-red-600 dark:text-red-400">
                                    {errors.lines}
                                </p>
                            )}
                        </fieldset>

                        <section className={sectionClass}>
                            <h3 className={sectionTitleClass}>Контакты</h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field name="contactName" label="Контактное лицо" required error={errors.contactName}>
                                    {(p) => (
                                        <input
                                            {...p}
                                            autoComplete="name"
                                            value={values.contactName}
                                            onChange={(e) => set("contactName", e.target.value)}
                                        />
                                    )}
                                </Field>
                                <Field name="company" label="Компания" required error={errors.company}>
                                    {(p) => (
                                        <input
                                            {...p}
                                            autoComplete="organization"
                                            value={values.company}
                                            onChange={(e) => set("company", e.target.value)}
                                        />
                                    )}
                                </Field>
                                <Field name="email" label="Email" required error={errors.email} hint="На него придёт ответ поставщиков">
                                    {(p) => (
                                        <input
                                            {...p}
                                            type="email"
                                            autoComplete="email"
                                            value={values.email}
                                            onChange={(e) => set("email", e.target.value)}
                                        />
                                    )}
                                </Field>
                                <Field name="phone" label="Телефон" error={errors.phone}>
                                    {(p) => (
                                        <input
                                            {...p}
                                            type="tel"
                                            autoComplete="tel"
                                            placeholder="+7 999 123-45-67"
                                            value={values.phone}
                                            onChange={(e) => set("phone", e.target.value)}
                                        />
                                    )}
                                </Field>
                                <Field name="inn" label="ИНН компании" error={errors.inn} hint="Поставщику проще подготовить КП на юрлицо">
                                    {(p) => (
                                        <input
                                            {...p}
                                            inputMode="numeric"
                                            maxLength={12}
                                            value={values.inn}
                                            onChange={(e) => set("inn", e.target.value.replace(/\s/g, ""))}
                                        />
                                    )}
                                </Field>
                            </div>
                        </section>

                        <section className={sectionClass}>
                            <h3 className={sectionTitleClass}>Поставка</h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field name="deliveryRegion" label="Регион или город поставки" required error={errors.deliveryRegion}>
                                    {(p) => (
                                        <input
                                            {...p}
                                            autoComplete="address-level1"
                                            placeholder="Московская область, Подольск"
                                            value={values.deliveryRegion}
                                            onChange={(e) => set("deliveryRegion", e.target.value)}
                                        />
                                    )}
                                </Field>
                                <Field name="timeframe" label="Желаемый срок" required error={errors.timeframe}>
                                    {(p) => (
                                        <select
                                            {...p}
                                            value={values.timeframe}
                                            onChange={(e) => set("timeframe", e.target.value as QuoteFormValues["timeframe"])}
                                        >
                                            <option value="">— Выберите —</option>
                                            {QUOTE_TIMEFRAMES.map((t) => (
                                                <option key={t.value} value={t.value}>
                                                    {t.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </Field>
                                <div className="sm:col-span-2">
                                    <Field
                                        name="comment"
                                        label="Комментарий"
                                        error={errors.comment}
                                        hint={`Условия эксплуатации, интеграция с WMS, сменность — ${values.comment.length} / ${QUOTE_COMMENT_MAX}`}
                                    >
                                        {(p) => (
                                            <textarea
                                                {...p}
                                                rows={4}
                                                value={values.comment}
                                                onChange={(e) => set("comment", e.target.value)}
                                            />
                                        )}
                                    </Field>
                                </div>
                            </div>

                            {/* Ловушка для ботов: людям не видна и недоступна с клавиатуры */}
                            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                                <label>
                                    Сайт
                                    <input
                                        tabIndex={-1}
                                        autoComplete="off"
                                        name="website"
                                        value={values.website}
                                        onChange={(e) => set("website", e.target.value)}
                                    />
                                </label>
                            </div>
                        </section>

                        <div className={sectionClass}>
                            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                                <input
                                    id={fieldId("consent")}
                                    type="checkbox"
                                    checked={values.consent}
                                    onChange={(e) => set("consent", e.target.checked)}
                                    aria-invalid={errors.consent ? true : undefined}
                                    aria-describedby={errors.consent ? fieldId("consent-error") : undefined}
                                    required
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-700"
                                />
                                <span>
                                    Согласен на обработку моих персональных данных и их передачу выбранным поставщикам для подготовки
                                    коммерческого предложения — в соответствии с{" "}
                                    <Link
                                        to="/privacy"
                                        target="_blank"
                                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        уведомлением об обработке персональных данных
                                    </Link>
                                    .{" "}
                                    <span className="text-red-600" aria-hidden>
                                        *
                                    </span>
                                </span>
                            </label>
                            {errors.consent && (
                                <p id={fieldId("consent-error")} className="mt-2 pl-7 text-xs text-red-600 dark:text-red-400">
                                    {errors.consent}
                                </p>
                            )}
                        </div>

                        {sendError && (
                            <div
                                role="alert"
                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            >
                                {sendError}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            <button type="submit" disabled={sending} className={primaryBtn}>
                                {sending ? "Отправляем…" : sendError ? "Отправить ещё раз" : "Отправить запрос"}
                            </button>
                            <Link to={backTo} className={secondaryBtn}>
                                Отмена
                            </Link>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                <span className="text-red-600" aria-hidden>
                                    *
                                </span>{" "}
                                — обязательные поля
                            </span>
                        </div>
                    </div>

                    {/* Кому уйдёт запрос — обновляется по отметкам */}
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <div className={sectionClass}>
                            <h3 className={sectionTitleClass}>Получат запрос</h3>
                            {groups.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">Отметьте решения слева.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {groups.map((g) => (
                                        <li key={g.supplierName}>
                                            <p className="text-sm font-semibold">{g.supplierName}</p>
                                            <ul className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                {g.lines.map((l) => (
                                                    <li key={l.productId} className="flex justify-between gap-2">
                                                        <span className="truncate">{l.name}</span>
                                                        <span className="shrink-0 tabular-nums">× {l.quantity || "?"}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                {groups.length > 1
                                    ? `Запрос разделится на ${groups.length} части — каждый поставщик увидит только свои позиции.`
                                    : "Поставщик увидит свои позиции и ваши контакты."}
                            </p>
                        </div>
                    </aside>
                </form>
            )}
        </div>
    );
}

type FieldProps = {
    id: string;
    name: string;
    className: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    "aria-required"?: boolean;
};

/** Поле формы: подпись, ошибка и подсказка связаны с полем через aria-describedby */
function Field({
    name,
    label,
    required,
    error,
    hint,
    children,
}: {
    name: QuoteField;
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: (props: FieldProps) => ReactNode;
}) {
    const id = fieldId(name);
    const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
    return (
        <div>
            <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {label}
                {required && (
                    <span className="ml-0.5 text-red-600" aria-hidden>
                        *
                    </span>
                )}
            </label>
            {children({
                id,
                name,
                className: `${inputClass} ${error ? invalidClass : ""}`,
                "aria-invalid": error ? true : undefined,
                "aria-describedby": describedBy,
                "aria-required": required || undefined,
            })}
            {error && (
                <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
            {hint && (
                <p id={`${id}-hint`} className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {hint}
                </p>
            )}
        </div>
    );
}

/** Экран после отправки: номер запроса и кто его получит */
function QuoteSuccess({ receipt, backTo }: { receipt: QuoteReceipt; backTo: string }) {
    const total = receipt.suppliers.reduce((n, s) => n + s.items.length, 0);
    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <section
                className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/40"
                role="status"
            >
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Запрос принят</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    № {formatQuoteNumber(receipt.displayNumber)}
                </h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    Платформа передаст запрос поставщикам: {receipt.suppliers.length}{" "}
                    {plural(receipt.suppliers.length, ["поставщик", "поставщика", "поставщиков"])}, {positionsLabel(total)}. Ответы придут
                    на <span className="font-medium">{receipt.email}</span>. Сохраните номер — по нему поставщик и команда платформы найдут
                    ваш запрос.
                </p>
            </section>

            <section className={sectionClass}>
                <h3 className={sectionTitleClass}>Кто получит запрос</h3>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {receipt.suppliers.map((s) => (
                        <li key={s.companyName} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm font-semibold">{s.companyName}</p>
                            <ul className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                {s.items.map((i) => (
                                    <li key={i.productId ?? i.productName} className="flex flex-wrap justify-between gap-2">
                                        <span>{i.productName}</span>
                                        <span className="tabular-nums text-slate-500 dark:text-slate-400">
                                            {i.quantity} шт · {formatPrice(i.unitPrice)} за ед. по каталогу
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Каждый поставщик увидит только свои позиции и ваши контакты. Цена из каталога — ориентир: точную стоимость с доставкой и
                    внедрением назовёт поставщик в КП.
                </p>
            </section>

            <div className="flex flex-wrap gap-3">
                <Link to={backTo} className={secondaryBtn}>
                    Вернуться
                </Link>
                <Link to="/robots" className={primaryBtn}>
                    В каталог
                </Link>
            </div>
        </div>
    );
}
