// Правила по высоте подъёма — на паспортных данных каталога v2 (lift_height_mm,
// lift_residual_payload_kg) и высоте ярусов из листа «Стеллажи».
//
// Проверяем только то, что производитель заявил: если высоты подъёма в карточке нет,
// правило не применяется — молчаливых допущений в исключениях быть не должно (ТЗ 3.4.2).

import type { CargoType, RackType } from "../store/store";
import { m, rackTier } from "./rackSpecs";
import type { VizRobot } from "./robotSpecs";

/** Робот ставит груз на ярус стеллажа: вилочные и всё, что заявило высоту подъёма от полуметра */
const servesRacks = (robot: VizRobot) =>
    robot.type === "FMR" || robot.type === "CTU" || (robot.liftHeightMm ?? 0) >= 500;

/**
 * Причины, по которым робот не справится с ярусами выбранного стеллажа.
 * cargoMassKg — масса грузовой единицы (паллеты или короба).
 */
export function checkLift(
    robot: VizRobot,
    rackType: RackType | "",
    cargoType: CargoType | "",
    cargoMassKg: number,
): string[] {
    const why: string[] = [];
    const tier = rackTier(rackType, cargoType);
    // ASRS — стационарная система, ярусы у неё свои; вне правила
    if (!tier || robot.type === "ASRS" || !servesRacks(robot)) return why;

    if (robot.liftHeightMm && robot.liftHeightMm < tier.topTierMm * 0.95)
        why.push(
            `Поднимает груз на ${m(robot.liftHeightMm)} м, верхний ярус — ${m(tier.topTierMm)} м (${tier.source})`,
        );

    if (robot.liftResidualKg && cargoMassKg > robot.liftResidualKg)
        why.push(
            `На максимальной высоте поднимает ${robot.liftResidualKg} кг, ваш груз ${Math.round(cargoMassKg)} кг`,
        );

    return why;
}
