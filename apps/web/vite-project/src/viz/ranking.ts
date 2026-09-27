// Ранжирование подобранных решений с объяснением вклада факторов (ТЗ 3.4.5).
//
// Оценка — не истина, а способ упорядочить список: веса заданы явно, вклад каждого фактора
// показывается пользователю в баллах, а сравнение идёт внутри набора подходящих решений
// («лучшее из того, что подошло»), а не по абсолютной шкале.

import { effectiveThroughput, peakDemandPerHour, robotsRequired, type Norms, type SiteInput } from "./economics";
import type { VizRobot } from "./robotSpecs";

export type RankInput = {
    id: string;
    robot: VizRobot;
    /** Минимальная ширина прохода для этого робота, м; 0 — проход не нужен (стационарные) */
    minAisle: number;
    /** Статус из каталога организатора */
    status: "operation" | "piloting" | "rnd";
    /** Уровень готовности технологии, 1–9 */
    ugt: number | null;
    /** ТТХ подтверждены производителем */
    verified: boolean;
};

export type ScorePart = {
    key: string;
    label: string;
    /** Вес фактора в итоговой оценке, баллов */
    weight: number;
    /** Насколько решение отвечает фактору, 0…1 */
    value: number;
    /** Полученные баллы = weight × value */
    points: number;
    /** Человеческое объяснение: откуда взялось значение */
    note: string;
};

export type Ranked<T> = { item: T; score: number; parts: ScorePart[] };

/** Веса в сумме дают 100 — итоговая оценка читается как проценты */
export const WEIGHTS = {
    fleetCost: 35,
    units: 15,
    payload: 15,
    readiness: 15,
    dataTrust: 10,
    aisle: 10,
} as const;

export const WEIGHT_NOTE =
    "Веса: стоимость парка 35, число роботов 15, запас грузоподъёмности 15, готовность решения 15, достоверность ТТХ 10, запас по проходу 10.";

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * «Меньше — лучше» относительно лучшего в наборе: вдвое дороже лучшего — половина баллов.
 * Линейная нормализация между худшим и лучшим здесь не годится: один дорогой робот в выборке
 * растягивает шкалу так, что все остальные получают почти полный балл.
 */
const lowerIsBetter = (v: number, best: number) => (v <= 0 ? 1 : clamp(best / v));

const STATUS_SCORE: Record<RankInput["status"], number> = { operation: 1, piloting: 0.6, rnd: 0.25 };
const STATUS_LABEL: Record<RankInput["status"], string> = {
    operation: "в эксплуатации",
    piloting: "пилотный проект",
    rnd: "НИОКР",
};
const SOURCE_SCORE: Record<VizRobot["specsSource"], number> = { specs: 1, v0: 0.5, "type-default": 0.2 };
const SOURCE_LABEL: Record<VizRobot["specsSource"], string> = {
    specs: "паспортные данные из каталога",
    v0: "оценка по открытым источникам",
    "type-default": "типовые значения для класса",
};

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

/**
 * Считает оценку каждому решению и раскладку по факторам.
 * cargoMassKg — масса грузовой единицы, aisleWidth — ширина прохода на объекте.
 */
export function rankOffers<T extends RankInput>(
    items: T[],
    site: SiteInput,
    norms: Norms,
    cargoMassKg: number,
    aisleWidth: number,
): Ranked<T>[] {
    if (items.length === 0) return [];

    const metrics = items.map((i) => {
        const units = robotsRequired(site, { name: i.robot.name, price: i.robot.price, throughputPerHour: i.robot.throughputPerHour }, norms);
        return { id: i.id, units, fleet: units * i.robot.price };
    });
    const fleets = metrics.map((m) => m.fleet);
    const unitCounts = metrics.map((m) => m.units);
    const bestFleet = Math.min(...fleets);

    const bestUnits = Math.min(...unitCounts);
    const peak = peakDemandPerHour(site);

    return items
        .map((item, n) => {
            const { units, fleet } = metrics[n];
            const { robot } = item;

            // Запас грузоподъёмности: двукратный и выше считаем полным баллом
            const payloadRatio = cargoMassKg > 0 ? robot.payloadKg / cargoMassKg : 2;
            // Готовность: статус из каталога организатора весит больше, чем УГТ
            const readiness = 0.6 * STATUS_SCORE[item.status] + 0.4 * ((item.ugt ?? 5) / 9);
            // Достоверность: откуда взяты ТТХ плюс подтверждение производителем
            const trust = clamp(0.8 * SOURCE_SCORE[robot.specsSource] + (item.verified ? 0.2 : 0));
            // Запас по проходу: важен не максимум свободного места, а отсутствие работы впритык.
            // Комфортным считаем запас в 30% ширины прохода — дальше баллы не растут.
            const comfort = 0.3 * Math.max(0.1, aisleWidth);
            const aisleValue = item.minAisle <= 0 ? 1 : clamp((aisleWidth - item.minAisle) / comfort);

            const parts: ScorePart[] = [
                {
                    key: "fleetCost",
                    label: "Стоимость парка",
                    weight: WEIGHTS.fleetCost,
                    value: lowerIsBetter(fleet, bestFleet),
                    points: 0,
                    note:
                        fleet <= bestFleet * 1.02
                            ? `${fmt(fleet)} ₽ — лучшая стоимость парка среди подходящих`
                            : `${fmt(fleet)} ₽ — в ${(fleet / bestFleet).toFixed(1)} раза дороже лучшего (${fmt(bestFleet)} ₽)`,
                },
                {
                    key: "units",
                    label: "Число роботов",
                    weight: WEIGHTS.units,
                    value: lowerIsBetter(units, bestUnits),
                    points: 0,
                    note: `${units} шт на ${Math.round(peak)} операций в пик; меньше единиц — меньше зарядных мест и точек отказа`,
                },
                {
                    key: "payload",
                    label: "Запас грузоподъёмности",
                    weight: WEIGHTS.payload,
                    value: clamp(payloadRatio - 1),
                    points: 0,
                    note: `${fmt(robot.payloadKg)} кг против груза ${fmt(cargoMassKg)} кг — запас ${payloadRatio.toFixed(1)}×`,
                },
                {
                    key: "readiness",
                    label: "Готовность решения",
                    weight: WEIGHTS.readiness,
                    value: readiness,
                    points: 0,
                    note: `${STATUS_LABEL[item.status]}, УГТ ${item.ugt ?? "не указан"}`,
                },
                {
                    key: "dataTrust",
                    label: "Достоверность ТТХ",
                    weight: WEIGHTS.dataTrust,
                    value: trust,
                    points: 0,
                    note: `${SOURCE_LABEL[robot.specsSource]}${item.verified ? ", подтверждены производителем" : ", без подтверждения производителя"}`,
                },
                {
                    key: "aisle",
                    label: "Запас по проходу",
                    weight: WEIGHTS.aisle,
                    value: aisleValue,
                    points: 0,
                    note:
                        item.minAisle <= 0
                            ? "проход не требуется: стационарная система"
                            : `нужно ${item.minAisle} м при ваших ${aisleWidth} м — запас ${(aisleWidth - item.minAisle).toFixed(1)} м`,
                },
            ].map((p) => ({ ...p, points: +(p.weight * p.value).toFixed(1) }));

            const score = Math.round(parts.reduce((a, p) => a + p.points, 0));
            return { item, score, parts };
        })
        .sort((a, b) => b.score - a.score || a.item.robot.price - b.item.robot.price);
}

/** Два фактора, давшие больше всего баллов — короткое объяснение места в списке */
export const topReasons = (parts: ScorePart[], n = 2) =>
    [...parts].sort((a, b) => b.points - a.points).slice(0, n);

/** Фактор, который сильнее всего недобрал — что мешает решению подняться выше */
export const weakest = (parts: ScorePart[]) =>
    [...parts].sort((a, b) => a.weight - a.points - (b.weight - b.points))[parts.length - 1];

export const effectivePerRobot = (robot: VizRobot, norms: Norms) =>
    Math.round(effectiveThroughput({ name: robot.name, price: robot.price, throughputPerHour: robot.throughputPerHour }, norms));
