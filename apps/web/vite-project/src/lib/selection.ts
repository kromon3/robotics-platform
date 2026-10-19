import axios from "axios";
import type { Product, ProductsResponse } from "../api/catalog.ts";
import type { NumericFormData } from "../store/store";
import type { EconNumeric } from "../store/econStore";
import { toVizRobot, type VizRobot } from "../viz/robotSpecs";
import { checkCompat, minAisle } from "../viz/core/rules";
import { checkLift } from "../viz/liftRules";
import { rankOffers } from "../viz/ranking";
import { DEFAULT_NORMS } from "../viz/economics";
import { buildCargo, toNorms, toSiteInput, type RouteOptions } from "../viz/adapter";

// Подбор решений для объекта: кандидаты из каталога → правила совместимости → ранжирование.
// Общий для витрины подбора и демо: решение, которое демо называет лучшим, совпадает с тем,
// что покажет витрина на тех же данных.

const API_URL = import.meta.env.VITE_API_URL;

/** Кандидаты — складские сценарии каталога организатора. Дальше их фильтруют правила совместимости */
export const WAREHOUSE_SCENARIOS = ["Внутрискладская логистика", "Сортировка грузов", "Внутрипроизводственная логистика"];

export async function fetchWarehouseProducts(signal: AbortSignal): Promise<Product[]> {
    const pages = await Promise.all(
        WAREHOUSE_SCENARIOS.map((scenario) =>
            axios
                .get<ProductsResponse>(`${API_URL}/catalog/products`, { params: { scenario, limit: 100 }, signal })
                .then((r) => r.data.items),
        ),
    );
    const byId = new Map<string, Product>();
    for (const p of pages.flat()) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export type Offer = { product: Product; robot: VizRobot; reasons: string[]; minAisle: number };

/**
 * Правила совместимости робот ↔ стеллаж ↔ груз + грузоподъёмность, проход и высота подъёма.
 * reasons пустой — решение подходит; иначе — объяснение, почему исключено (ТЗ п. 3.4.2).
 */
export function splitOffers(items: Product[], p: NumericFormData): { fit: Offer[]; excluded: Offer[] } {
    const cargo = buildCargo(p);
    const offers: Offer[] = items.map((product) => {
        const robot = toVizRobot(product);
        const reasons: string[] =
            product.type === "software"
                ? ["Программное обеспечение, а не робот — учитывается отдельно"]
                : checkCompat(robot, p.rackType, cargo);
        const aisle = robot.type === "ASRS" ? 0 : minAisle(robot, cargo);
        if (aisle > p.aisleWidth + 0.5) reasons.push(`Нужен проход не уже ${aisle} м, у вас ${p.aisleWidth} м`);
        // Паспортная высота подъёма против высоты верхнего яруса выбранного стеллажа
        if (product.type !== "software") reasons.push(...checkLift(robot, p.rackType, p.cargoType, cargo.unit.massKg));
        return { product, robot, reasons, minAisle: aisle };
    });
    return {
        fit: offers.filter((o) => o.reasons.length === 0),
        excluded: offers.filter((o) => o.reasons.length > 0),
    };
}

/** Масса единицы груза, которую везёт робот, кг */
export const cargoMassOf = (p: NumericFormData) =>
    p.cargoType === "pallet" ? p.palletMass : p.cargoType === "long" ? Math.max(p.skuMass, 150) : p.skuMass;

/**
 * Ранжирование подходящих решений с раскладкой по факторам (ТЗ 3.4.5).
 * econ не задан — экономика на типовых значениях датасета; routeOpts — ворота и время погрузки,
 * те же, что в отчёте, чтобы число роботов совпадало на всех экранах.
 */
export function rankFit(fit: Offer[], p: NumericFormData, econ: EconNumeric | undefined, routeOpts?: RouteOptions) {
    return rankOffers(
        fit.map((o) => ({
            id: o.product.id,
            robot: o.robot,
            minAisle: o.minAisle,
            status: o.product.status,
            ugt: o.product.ugt,
            verified: o.product.verified,
            offer: o,
        })),
        toSiteInput(p, econ),
        econ ? toNorms(econ, DEFAULT_NORMS, p) : DEFAULT_NORMS,
        cargoMassOf(p),
        p.aisleWidth,
        { form: p, econ, routeOpts },
    );
}
