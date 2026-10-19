import type { NumericFormData } from "../store/store";
import type { EconNumeric } from "../store/econStore";
import { rackTier } from "../viz/rackSpecs";
import { buildCargo } from "../viz/adapter";

// Проверка сочетаний параметров объекта на правдоподобие.
//
// Поля по отдельности уже проверены диапазонами (FIELD_LIMITS, ECON_LIMITS), но сочетания —
// нет: склад 10 × 10 м с 6000 строк отбора в сутки проходит обе проверки и даёт отчёт,
// который выглядит убедительно и не значит ничего.
//
// Все проверки МЯГКИЕ: предупреждают, но не мешают считать. Мы не знаем объект пользователя
// лучше него — бывают и плотные мезонины, и склады с запасом площади. Поэтому пороги
// подобраны так, чтобы ловить заведомо невозможное, а не «нетипичное».
//
// Пороги — модельные допущения (как и нормативы в src/viz/economics.ts), в отчёте они
// попадают в допущения. Экономисты команды могут их уточнить: все собраны здесь, в THRESHOLDS.

export const THRESHOLDS = {
    /** Строк отбора на м² в сутки: выше — столько людей и техники на площадь не поместится */
    linesPerM2Day: 25,
    /** Перемещений поддонов на м² в сутки для паллетных складов */
    palletsPerM2Day: 10,
    /** Людей меньше этой доли от расчётной потребности — объём некому выполнять */
    staffShortfall: 0.7,
    /** Людей больше этой кратности — либо выработка занижена, либо численность не та */
    staffExcess: 2,
    /** Доля площади под стеллажами: выше — не остаётся места на проходы, ворота и упаковку */
    storageAreaShare: 0.6,
    /** Расхождение часов работы между фазами, ч */
    workHoursTolerance: 1,
    /** Запас прохода к габариту грузовой единицы, м */
    aisleClearance: 0.2,
} as const;

export type RealismWarning = {
    key: string;
    /** Поля, из которых сложилось расхождение — на них ссылается текст предупреждения */
    fields: string[];
    title: string;
    /** Объяснение с обеими цифрами: что получилось и с чем это не сходится */
    note: string;
};

const round = (v: number, digits = 1) => +v.toFixed(digits);
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

/** Операций в сутки: для паллетных складов это приёмка и отгрузка, для остальных — строки отбора */
export const dailyOperations = (p: NumericFormData) =>
    p.cargoType === "pallet" ? p.receivePalletsDay + p.shipPalletsDay : p.pickLinesDay;

/**
 * Поперечный габарит грузовой единицы, м — им определяется минимально возможный проход.
 * Берём меньшую сторону, а не большую: длинномер и паллету везут вдоль прохода, а не поперёк,
 * поэтому нижняя граница ширины прохода — узкая сторона груза. Размеры — из того же buildCargo,
 * что использует подбор, чтобы проверка и правила совместимости говорили об одном и том же грузе.
 */
const cargoWidthM = (p: NumericFormData) => {
    const { unit } = buildCargo(p);
    return Math.min(unit.l, unit.w);
};

/**
 * Что в параметрах не сходится друг с другом. Пустой массив — противоречий не нашли.
 * econ не задан — проверяем только первую фазу визарда.
 */
export function checkRealism(p: NumericFormData, econ?: EconNumeric): RealismWarning[] {
    const out: RealismWarning[] = [];
    const area = p.width * p.length;
    const ops = dailyOperations(p);
    const isPallet = p.cargoType === "pallet";

    // 1. Интенсивность на площадь
    if (area > 0 && ops > 0) {
        const density = ops / area;
        const limit = isPallet ? THRESHOLDS.palletsPerM2Day : THRESHOLDS.linesPerM2Day;
        const unit = isPallet ? "перемещений поддонов" : "строк отбора";
        if (density > limit) {
            out.push({
                key: "density",
                fields: ["width", "length", isPallet ? "receivePalletsDay" : "pickLinesDay"],
                title: "Слишком высокая интенсивность для такой площади",
                note: `${fmt(ops)} ${unit} в сутки на ${fmt(area)} м² — это ${round(density)} на квадратный метр, а столько людей и техники на площадь не помещается (ориентир — до ${limit}). Проверьте габариты объекта или объём операций.`,
            });
        }
    }

    // 2. Отбор штук не может быть меньше, чем строк: в строке минимум одна штука
    if (!isPallet && p.pickLinesDay > 0 && p.pickPiecesDay > 0 && p.pickPiecesDay < p.pickLinesDay) {
        out.push({
            key: "piecesVsLines",
            fields: ["pickPiecesDay", "pickLinesDay"],
            title: "Штук отбирается меньше, чем строк",
            note: `${fmt(p.pickPiecesDay)} штук при ${fmt(p.pickLinesDay)} строках: в одной строке минимум одна штука, поэтому штук не может быть меньше.`,
        });
    }

    // 3. Паллетоместа против площади: сколько пола займут стеллажи со всеми ярусами
    const tier = rackTier(p.rackType, p.cargoType);
    if (tier && p.palletPlaces > 0 && area > 0) {
        const unitArea = (p.pallet.L * p.pallet.W) / 1e6;
        const floorNeeded = (p.palletPlaces / tier.tiers) * unitArea;
        const share = floorNeeded / area;
        if (share > THRESHOLDS.storageAreaShare) {
            out.push({
                key: "placesVsArea",
                fields: ["palletPlaces", "width", "length"],
                title: "Столько мест хранения на эту площадь не встанет",
                note: `${fmt(p.palletPlaces)} мест в ${tier.tiers} яруса займут ${fmt(floorNeeded)} м² пола — ${Math.round(share * 100)}% площади объекта. На проходы, ворота и зону упаковки не останется места (ориентир — не больше ${Math.round(THRESHOLDS.storageAreaShare * 100)}%).`,
            });
        }
    }

    // 4. Проход против груза: робот везёт единицу груза, она должна пройти между стеллажами
    const cargo = cargoWidthM(p);
    if (p.aisleWidth > 0 && cargo > 0 && p.aisleWidth < cargo + THRESHOLDS.aisleClearance) {
        out.push({
            key: "aisleVsCargo",
            fields: ["aisleWidth"],
            title: "Проход уже самого груза",
            note: `проход ${round(p.aisleWidth, 2)} м при узкой стороне груза ${round(cargo, 2)} м — робот не провезёт груз даже без запаса на манёвр.`,
        });
    }

    if (!econ) return out;

    // 5. Часы работы в двух фазах описывают один и тот же календарь
    const shiftTotal = econ.shiftsPerDay * econ.shiftHours;
    if (p.workHours > 0 && shiftTotal > 0 && Math.abs(p.workHours - shiftTotal) > THRESHOLDS.workHoursTolerance) {
        out.push({
            key: "hoursVsShifts",
            fields: ["workHours", "shiftsPerDay", "shiftHours"],
            title: "Часы работы объекта и смены расходятся",
            note: `в параметрах объекта ${round(p.workHours)} ч в сутки, а смены дают ${round(shiftTotal)} ч (${econ.shiftsPerDay} × ${round(econ.shiftHours)} ч). Это один и тот же календарь — расчёт возьмёт смены.`,
        });
    }

    // 6. Персонал против объёма. Только для штучного отбора: выработка задана в строках на
    // человека в час, для паллетных складов работу делают водители погрузчиков, и норматива
    // их выработки в форме нет — проверять нечем
    if (!isPallet && ops > 0 && econ.pickerLinesPerHour > 0 && econ.shiftHours > 0 && econ.staffPickers > 0) {
        const required = ops / econ.pickerLinesPerHour / econ.shiftHours;
        const ratio = econ.staffPickers / required;
        if (ratio < THRESHOLDS.staffShortfall) {
            out.push({
                key: "staffShortfall",
                fields: ["staffPickers", "pickLinesDay", "pickerLinesPerHour"],
                title: "Отборщиков не хватает на заявленный объём",
                note: `${fmt(ops)} строк при выработке ${round(econ.pickerLinesPerHour)} строк/ч и смене ${round(econ.shiftHours)} ч требуют примерно ${Math.ceil(required)} чел., а указано ${fmt(econ.staffPickers)}. Экономия на роботах считается от ФОТ — заниженная численность занизит и эффект.`,
            });
        } else if (ratio > THRESHOLDS.staffExcess) {
            out.push({
                key: "staffExcess",
                fields: ["staffPickers", "pickLinesDay", "pickerLinesPerHour"],
                title: "Отборщиков заметно больше, чем нужно на объём",
                note: `на ${fmt(ops)} строк по нормативу хватает примерно ${Math.ceil(required)} чел., а указано ${fmt(econ.staffPickers)} — вдвое с лишним больше. Либо в численность попали другие работы, либо выработка ${round(econ.pickerLinesPerHour)} строк/ч занижена; эффект роботизации выйдет завышенным.`,
            });
        }
    }

    return out;
}
