import { describe, expect, it } from "vitest";
import type { Product } from "../api/catalog.ts";
import {
    EMPTY_QUOTE_FORM,
    PRIVACY_NOTICE_VERSION,
    buildQuotePayload,
    errorCount,
    groupLinesBySupplier,
    hasErrors,
    isValidInn,
    linesFromProducts,
    plural,
    positionsLabel,
    quantityError,
    quoteErrorMessage,
    validateQuoteForm,
    type QuoteFormValues,
} from "./quote-form";

const product = (id: string, companyId: string, companyName: string, price: string | null = "2700000"): Product => ({
    id,
    name: `Робот ${id}`,
    type: "brs",
    status: "operation",
    subtype: null,
    category: null,
    description: null,
    price,
    ugt: null,
    marketPotential: null,
    specs: {},
    sourceUrl: null,
    sourceDate: null,
    verified: false,
    catalogVersion: 4,
    companyId,
    company: { id: companyId, name: companyName, region: null },
});

const lines = linesFromProducts([
    product("p1", "c1", "Ronavi Robotics"),
    product("p2", "c2", "Automacon"),
    product("p3", "c1", "Ronavi Robotics", null),
]);

const filled: QuoteFormValues = {
    ...EMPTY_QUOTE_FORM,
    contactName: "  Иван Петров ",
    company: "ООО «Склад»",
    email: " zakupki@sklad.ru ",
    deliveryRegion: "Подольск",
    timeframe: "1-3m",
    consent: true,
};

describe("форма КП: проверка", () => {
    it("заполненная форма без ошибок", () => {
        expect(validateQuoteForm(filled, lines)).toEqual({});
    });

    it("пустая форма — ошибки у всех обязательных полей и согласия", () => {
        const errors = validateQuoteForm(EMPTY_QUOTE_FORM, lines);
        expect(Object.keys(errors).sort()).toEqual(["company", "consent", "contactName", "deliveryRegion", "email", "timeframe"].sort());
        expect(errorCount(errors)).toBe(6);
    });

    it("без согласия на обработку ПДн отправить нельзя", () => {
        const errors = validateQuoteForm({ ...filled, consent: false }, lines);
        expect(errors.consent).toMatch(/согласия/);
        expect(hasErrors(errors)).toBe(true);
    });

    it("email, телефон и ИНН проверяются по формату", () => {
        const errors = validateQuoteForm({ ...filled, email: "zakupki@", phone: "позвоните", inn: "1234567890" }, lines);
        expect(errors.email).toBeDefined();
        expect(errors.phone).toBeDefined();
        expect(errors.inn).toBeDefined();
        expect(validateQuoteForm({ ...filled, phone: "+7 (999) 123-45-67", inn: "7707083893" }, lines)).toEqual({});
    });

    it("ИНН: контрольная сумма для 10 и 12 цифр", () => {
        expect(isValidInn("7707083893")).toBe(true);
        expect(isValidInn("500100732259")).toBe(true);
        expect(isValidInn("7707083894")).toBe(false);
        expect(isValidInn("50010073225")).toBe(false);
    });

    it("нужна хотя бы одна отмеченная позиция", () => {
        const none = lines.map((l) => ({ ...l, selected: false }));
        expect(validateQuoteForm(filled, none).lines).toBe("Отметьте хотя бы одно решение");
    });

    it("количество — целое от 1 до 10 000, только у отмеченных", () => {
        expect(quantityError("")).toBe("Укажите количество");
        expect(quantityError("1.5")).toBe("Целое число");
        expect(quantityError("0")).toBe("Не меньше 1");
        expect(quantityError("10001")).toMatch(/Не больше/);
        expect(quantityError(" 3 ")).toBeNull();
        const bad = lines.map((l, i) => (i === 0 ? { ...l, quantity: "0" } : i === 1 ? { ...l, quantity: "", selected: false } : l));
        expect(validateQuoteForm(filled, bad).quantities).toEqual({ p1: "Не меньше 1" });
    });

    it("комментарий не длиннее 2000 символов", () => {
        expect(validateQuoteForm({ ...filled, comment: "а".repeat(2001) }, lines).comment).toBeDefined();
    });
});

describe("форма КП: тело запроса", () => {
    it("только отмеченные позиции, количество числом, поля обрезаны", () => {
        const selected = lines.map((l) =>
            l.productId === "p2" ? { ...l, selected: false } : l.productId === "p3" ? { ...l, quantity: " 4 " } : l,
        );
        const payload = buildQuotePayload(filled, selected, "compare");
        expect(payload).toEqual({
            contactName: "Иван Петров",
            company: "ООО «Склад»",
            email: "zakupki@sklad.ru",
            deliveryRegion: "Подольск",
            timeframe: "1-3m",
            consent: true,
            consentVersion: PRIVACY_NOTICE_VERSION,
            items: [
                { productId: "p1", quantity: 1 },
                { productId: "p3", quantity: 4 },
            ],
            source: "compare",
        });
    });

    it("пустые необязательные поля не отправляются, заполненные — отправляются", () => {
        const payload = buildQuotePayload({ ...filled, phone: "  ", inn: "7707083893", comment: " две смены " }, lines);
        expect("phone" in payload).toBe(false);
        expect("website" in payload).toBe(false);
        expect("source" in payload).toBe(false);
        expect(payload.inn).toBe("7707083893");
        expect(payload.comment).toBe("две смены");
    });

    it("ловушка для ботов уходит на сервер, если её заполнили", () => {
        expect(buildQuotePayload({ ...filled, website: "http://spam" }, lines).website).toBe("http://spam");
    });
});

describe("форма КП: кому уйдёт и ошибки", () => {
    it("позиции группируются по поставщикам, как на бэкенде", () => {
        const groups = groupLinesBySupplier(lines);
        expect(groups.map((g) => [g.supplierName, g.lines.map((l) => l.productId)])).toEqual([
            ["Automacon", ["p2"]],
            ["Ronavi Robotics", ["p1", "p3"]],
        ]);
        expect(groupLinesBySupplier(lines.map((l) => ({ ...l, selected: l.productId === "p2" })))).toHaveLength(1);
    });

    it("понятные сообщения по ответу сервера", () => {
        expect(quoteErrorMessage(null)).toMatch(/Нет связи/);
        expect(quoteErrorMessage({ status: 429 })).toMatch(/Слишком много/);
        expect(quoteErrorMessage({ status: 400, message: ["Укажите корректный email"] })).toBe(
            "Сервер не принял запрос: Укажите корректный email.",
        );
        expect(quoteErrorMessage({ status: 400, message: ["А", "А", "Б", "В", "Г", "Д"] })).toBe(
            "Сервер не принял запрос: А; Б; В и ещё 2.",
        );
        expect(quoteErrorMessage({ status: 500 })).toMatch(/ошибка на сервере/);
    });

    it("склонение «позиция»", () => {
        expect([1, 2, 5, 11, 21, 22].map(positionsLabel)).toEqual([
            "1 позиция",
            "2 позиции",
            "5 позиций",
            "11 позиций",
            "21 позиция",
            "22 позиции",
        ]);
    });

    it("склонение по числу: 8 полей, 3 поставщика, 12 поставщиков", () => {
        const forms: [string, string, string] = ["поставщик", "поставщика", "поставщиков"];
        expect([1, 3, 8, 12, 101, 104].map((n) => plural(n, forms))).toEqual([
            "поставщик",
            "поставщика",
            "поставщиков",
            "поставщиков",
            "поставщик",
            "поставщика",
        ]);
    });
});
