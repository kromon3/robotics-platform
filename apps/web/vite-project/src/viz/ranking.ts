// Ранжирование подобранных решений с объяснением вклада факторов (ТЗ 3.4.5).
//
// Оценка — не истина, а способ упорядочить список: веса заданы явно, вклад каждого фактора
// показывается пользователю в баллах, а сравнение идёт внутри набора подходящих решений
// («лучшее из того, что подошло»), а не по абсолютной шкале.

import {
    computeScenario,
    effectiveThroughput,
    peakDemandPerHour,
    type Norms,
    type ScenarioEconomics,
    type SiteInput,
} from "./economics";
import type { VizRobot } from "./robotSpecs";
import { normsFor, toRobotInput, type RouteOptions } from "./adapter";
import type { NumericFormData } from "../store/store";
import type { EconNumeric } from "../store/econStore";

/** Параметры объекта для модели маршрута: без них производительность паспортная, как раньше */
export type RankContext = { form: NumericFormData; econ?: EconNumeric; routeOpts?: RouteOptions };

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

export type Ranked<T> = {
    item: T;
    score: number;
    parts: ScorePart[];
    /** Полный расчёт сценария «покупка» для этого решения — им же считается оценка */
    economics: ScenarioEconomics;
};

/** Веса в сумме дают 100 — итоговая оценка читается как проценты */
export const WEIGHTS = {
    payback: 25,
    tco: 15,
    units: 10,
    payload: 15,
    readiness: 15,
    dataTrust: 10,
    aisle: 10,
} as const;

export const WEIGHT_NOTE =
    "Веса: срок окупаемости 25, TCO за горизонт 15, число роботов 10, запас грузоподъёмности 15, готовность решения 15, достоверность ТТХ 10, запас по проходу 10. Экономика — 50 баллов из 100.";

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
 * ctx — параметры объекта: с ними производительность считается по модели маршрута,
 * тем же toRobotInput, что и в отчёте, поэтому число роботов на витрине и в отчёте совпадает.
 */
export function rankOffers<T extends RankInput>(
    items: T[],
    site: SiteInput,
    norms: Norms,
    cargoMassKg: number,
    aisleWidth: number,
    ctx?: RankContext,
): Ranked<T>[] {
    if (items.length === 0) return [];

    // Экономику считаем для каждого подходящего решения, а не только для выбранного:
    // платформа должна сама предлагать выгодный вариант, а не список совместимых (ТЗ 3.4.5).
    const metrics = items.map((i) => {
        const robot = toRobotInput(i.robot, ctx?.form, ctx?.econ, ctx?.routeOpts);
        return computeScenario("buy", site, robot, normsFor(norms, robot));
    });

    const paybacks = metrics.map((m) => m.paybackYears).filter((v): v is number => v !== null);
    const bestPayback = paybacks.length ? Math.min(...paybacks) : null;
    const bestTco = Math.min(...metrics.map((m) => m.tco));
    const bestUnits = Math.min(...metrics.map((m) => m.units));
    const peak = peakDemandPerHour(site);

    return items
        .map((item, n) => {
            const economics = metrics[n];
            const { units, tco, paybackYears, capex, annualEffect } = economics;
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
                    key: "payback",
                    label: "Срок окупаемости",
                    weight: WEIGHTS.payback,
                    // Не окупается — ноль баллов: такое решение рекомендовать нельзя
                    value: paybackYears === null || bestPayback === null ? 0 : lowerIsBetter(paybackYears, bestPayback),
                    points: 0,
                    note:
                        paybackYears === null
                            ? annualEffect <= 0
                                ? "не окупается: эксплуатация дороже замещаемого ФОТ"
                                : "не окупается на этих параметрах"
                            : bestPayback !== null && paybackYears <= bestPayback * 1.02
                              ? `${paybackYears} г. — лучший срок среди подходящих решений`
                              : `${paybackYears} г. против ${bestPayback} г. у лучшего решения`,
                },
                {
                    key: "tco",
                    label: "Совокупная стоимость владения",
                    weight: WEIGHTS.tco,
                    value: lowerIsBetter(tco, bestTco),
                    points: 0,
                    // «Лучший» — только если действительно минимальный. Процентный допуск тут врёт:
                    // TCO включает ФОТ оставшегося персонала, и 2% от него — это миллионы рублей
                    note:
                        tco - bestTco < 1
                            ? `${fmt(tco)} ₽ за ${norms.horizonYears} лет — лучший показатель`
                            : `${fmt(tco)} ₽ за ${norms.horizonYears} лет — на ${fmt(tco - bestTco)} ₽ дороже лучшего; разовые затраты ${fmt(capex)} ₽`,
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
            return { item, score, parts, economics };
        })
        .sort((a, b) => b.score - a.score || a.item.robot.price - b.item.robot.price);
}

/** Два фактора, давшие больше всего баллов — короткое объяснение места в списке */
export const topReasons = (parts: ScorePart[], n = 2) =>
    [...parts].sort((a, b) => b.points - a.points).slice(0, n);

/** Фактор, который сильнее всего недобрал — что мешает решению подняться выше */
export const weakest = (parts: ScorePart[]) =>
    [...parts].sort((a, b) => a.weight - a.points - (b.weight - b.points))[parts.length - 1];

/** Недобор меньше балла — не повод для предупреждения, это шум округления */
export const hasMeaningfulWeakness = (parts: ScorePart[]) => {
    const w = weakest(parts);
    return w !== undefined && w.weight - w.points >= 1;
};

/**
 * Сильные стороны для карточки рекомендации: где решение ближе всего к лучшему значению.
 * topReasons для этого не годится — он ранжирует по баллам, а окупаемость весит 25 и даёт
 * больше всех баллов, даже проигрывая другому решению. Тогда в «Почему это решение»
 * попадало «1,12 г. против 1,03 г. у лучшего» — недостаток под видом причины.
 * Слабая сторона сюда не попадает никогда: она показывается отдельно.
 */
export function strengths(parts: ScorePart[], n = 2): ScorePart[] {
    const weakKey = hasMeaningfulWeakness(parts) ? weakest(parts).key : null;
    const candidates = parts.filter((p) => p.key !== weakKey);
    // Только факторы, где решение на максимуме, — тяжёлые выше лёгких. Мягкий порог (0,95) не годится:
    // доля от лучшего у TCO сжата общим ФОТ, и 0,98 может означать «на 2,5 млн дороже»
    const strong = candidates.filter((p) => p.value >= 0.995).sort((a, b) => b.weight - a.weight);
    if (strong.length > 0) return strong.slice(0, n);
    // Сильных нет — показываем лучшее, что есть, честно по доле от максимума
    return [...candidates].sort((a, b) => b.value - a.value).slice(0, n);
}

export const effectivePerRobot = (robot: VizRobot, norms: Norms) =>
    Math.round(effectiveThroughput({ name: robot.name, price: robot.price, throughputPerHour: robot.throughputPerHour }, norms));
