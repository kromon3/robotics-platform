import type { Product } from "../api/catalog.ts";
import type { QuoteRequestPayload, QuoteSource, QuoteTimeframe } from "../api/quotes.ts";

// Форма «Запросить КП»: значения, проверка и сборка запроса — без React, чтобы проверять тестами.
// Правила совпадают с бэкендом (apps/api/src/quote-requests/dto/create-quote-request.dto.ts):
// клиентская проверка — для удобства, сервер всё равно проверяет сам.

/** Редакция уведомления об обработке ПДн (страница /privacy), с которой соглашается пользователь */
export const PRIVACY_NOTICE_VERSION = "2026-10-17";

export const QUOTE_MAX_QUANTITY = 10_000;
export const QUOTE_COMMENT_MAX = 2000;

export const QUOTE_TIMEFRAMES: { value: QuoteTimeframe; label: string }[] = [
    { value: "asap", label: "Как можно скорее" },
    { value: "1-3m", label: "В течение 1–3 месяцев" },
    { value: "3-6m", label: "Через 3–6 месяцев" },
    { value: "6-12m", label: "Через 6–12 месяцев" },
    { value: "exploring", label: "Пока изучаю рынок" },
];

export type QuoteFormValues = {
    contactName: string;
    company: string;
    email: string;
    phone: string;
    inn: string;
    deliveryRegion: string;
    timeframe: QuoteTimeframe | "";
    comment: string;
    consent: boolean;
    /** Ловушка для ботов */
    website: string;
};

export const EMPTY_QUOTE_FORM: QuoteFormValues = {
    contactName: "",
    company: "",
    email: "",
    phone: "",
    inn: "",
    deliveryRegion: "",
    timeframe: "",
    comment: "",
    consent: false,
    website: "",
};

/** Позиция запроса: решение, отмечено ли оно и сколько штук нужно (строка — как в поле ввода) */
export type QuoteLine = {
    productId: string;
    name: string;
    supplierId: string;
    supplierName: string;
    price: string | null;
    selected: boolean;
    quantity: string;
};

export function linesFromProducts(products: Product[]): QuoteLine[] {
    return products.map((p) => ({
        productId: p.id,
        name: p.name,
        supplierId: p.companyId ?? p.company?.id ?? "",
        supplierName: p.company?.name ?? "Поставщик не указан",
        price: p.price,
        selected: true,
        quantity: "1",
    }));
}

export type QuoteField = Exclude<keyof QuoteFormValues, "website">;
export type QuoteErrors = Partial<Record<QuoteField | "lines", string>> & {
    /** Ошибки количества по productId */
    quantities?: Record<string, string>;
};

const W10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const W11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const W12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const checksum = (d: number[], w: number[]) => (w.reduce((s, k, i) => s + k * d[i], 0) % 11) % 10;

/** ИНН по контрольным цифрам ФНС: 10 цифр — организация, 12 — ИП и физлицо */
export function isValidInn(value: string): boolean {
    if (!/^\d{10}$|^\d{12}$/.test(value)) return false;
    const d = value.split("").map(Number);
    if (d.length === 10) return checksum(d, W10) === d[9];
    return checksum(d, W11) === d[10] && checksum(d, W12) === d[11];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s()-]{6,30}$/;

/** Количество: целое от 1 до максимума; null — ошибки нет */
export function quantityError(raw: string): string | null {
    const s = raw.trim();
    if (!s) return "Укажите количество";
    if (!/^\d+$/.test(s)) return "Целое число";
    const n = Number(s);
    if (n < 1) return "Не меньше 1";
    if (n > QUOTE_MAX_QUANTITY) return `Не больше ${QUOTE_MAX_QUANTITY.toLocaleString("ru-RU")}`;
    return null;
}

export function validateQuoteForm(values: QuoteFormValues, lines: QuoteLine[]): QuoteErrors {
    const errors: QuoteErrors = {};
    const selected = lines.filter((l) => l.selected);
    if (selected.length === 0) errors.lines = "Отметьте хотя бы одно решение";
    const quantities: Record<string, string> = {};
    for (const line of selected) {
        const e = quantityError(line.quantity);
        if (e) quantities[line.productId] = e;
    }
    if (Object.keys(quantities).length > 0) errors.quantities = quantities;

    if (!values.contactName.trim()) errors.contactName = "Укажите контактное лицо";
    if (!values.company.trim()) errors.company = "Укажите компанию";
    if (!values.email.trim()) errors.email = "Укажите email — на него придёт ответ";
    else if (!EMAIL.test(values.email.trim())) errors.email = "Проверьте email: например, zakupki@company.ru";
    if (values.phone.trim() && !PHONE.test(values.phone.trim())) errors.phone = "Проверьте телефон: цифры, пробелы, скобки, дефис и «+»";
    if (values.inn.trim() && !isValidInn(values.inn.trim())) errors.inn = "ИНН — 10 цифр у организации или 12 у ИП, проверьте цифры";
    if (!values.deliveryRegion.trim()) errors.deliveryRegion = "Укажите регион или город поставки";
    if (!values.timeframe) errors.timeframe = "Выберите желаемый срок";
    if (values.comment.length > QUOTE_COMMENT_MAX) errors.comment = `Не больше ${QUOTE_COMMENT_MAX} символов`;
    if (!values.consent) errors.consent = "Без согласия на обработку персональных данных запрос не отправить";
    return errors;
}

export const hasErrors = (errors: QuoteErrors) => Object.keys(errors).length > 0;

/** Сколько ошибок показать в сводке над формой */
export const errorCount = (errors: QuoteErrors) =>
    Object.keys(errors).filter((k) => k !== "quantities").length + Object.keys(errors.quantities ?? {}).length;

/** Тело POST /quote-requests: только отмеченные позиции, пустые необязательные поля не отправляем */
export function buildQuotePayload(values: QuoteFormValues, lines: QuoteLine[], source?: QuoteSource): QuoteRequestPayload {
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    const payload: QuoteRequestPayload = {
        contactName: values.contactName.trim(),
        company: values.company.trim(),
        email: values.email.trim(),
        phone: opt(values.phone),
        inn: opt(values.inn),
        comment: opt(values.comment),
        deliveryRegion: values.deliveryRegion.trim(),
        timeframe: values.timeframe as QuoteTimeframe,
        consent: true,
        consentVersion: PRIVACY_NOTICE_VERSION,
        items: lines.filter((l) => l.selected).map((l) => ({ productId: l.productId, quantity: Number(l.quantity.trim()) })),
        source,
        website: opt(values.website),
    };
    // undefined-поля убираем, чтобы бэкенд с forbidNonWhitelisted видел ровно то, что заполнено
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)) as QuoteRequestPayload;
}

/** Кто получит запрос: отмеченные позиции по поставщикам, как их разложит бэкенд */
export function groupLinesBySupplier(lines: QuoteLine[]): { supplierName: string; lines: QuoteLine[] }[] {
    const groups = new Map<string, { supplierName: string; lines: QuoteLine[] }>();
    for (const line of lines.filter((l) => l.selected)) {
        const key = line.supplierId || line.supplierName;
        const group = groups.get(key) ?? { supplierName: line.supplierName, lines: [] };
        group.lines.push(line);
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName, "ru"));
}

/** Понятное сообщение об ошибке отправки по ответу сервера */
export function quoteErrorMessage(error: { status?: number; message?: string | string[] } | null): string {
    if (!error || error.status === undefined) return "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.";
    if (error.status === 429) return "Слишком много запросов подряд. Подождите несколько минут и отправьте снова.";
    if (error.status === 400) {
        // У одного поля бывает несколько сообщений — без повторов и не больше трёх
        const list = [...new Set(Array.isArray(error.message) ? error.message : error.message ? [error.message] : [])];
        if (list.length === 0) return "Сервер не принял запрос: проверьте поля формы.";
        return `Сервер не принял запрос: ${list.slice(0, 3).join("; ")}${list.length > 3 ? ` и ещё ${list.length - 3}` : ""}.`;
    }
    return "Не удалось отправить запрос — ошибка на сервере. Попробуйте ещё раз чуть позже.";
}

export const formatQuoteNumber = (displayNumber: string) => `КП-${displayNumber}`;

/** Форма слова по числу: plural(5, ["поставщик", "поставщика", "поставщиков"]) → «поставщиков» */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}

/** «1 позиция», «2 позиции», «5 позиций» */
export const positionsLabel = (n: number) => `${n} ${plural(n, ["позиция", "позиции", "позиций"])}`;
