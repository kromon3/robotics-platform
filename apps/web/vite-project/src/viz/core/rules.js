// ВСЕ правила «какой робот с каким стеллажом и грузом работает» — в одном месте. Меняйте только здесь.
import { ROBOT_TYPES, RACK_TYPES } from './catalog';

const MOBILE = Object.keys(ROBOT_TYPES).filter((k) => k !== 'ASRS');
const not = (...ex) => MOBILE.filter((k) => !ex.includes(k));

// Какие роботы работают со стеллажом
export const RACK_ROBOTS = {
  stack: not('SR', 'DOG', 'HUM'),        // зона хранения: без тележек SR, собак и гуманоидов
  shelf: not('SR', 'DOG', 'HUM'),        // фронтально-полочный: без тележек SR, собак и гуманоидов
  flow: not('SR', 'DOG', 'HUM'),         // поточный: то же
  deep: ['CTU', 'FMR', 'ASRS'],          // глубинный: вилочные и стационарные шаттлы
  cantilever: ['CTU', 'FMR'],            // консольный: только с вилами
  mezzanine: ['DOG', 'HUM'],             // мезонин: робособаки и гуманоиды
};

// Какие грузы допустимы для стеллажа
export const RACK_CARGO = {
  stack: ['pallet', 'box', 'long'],
  shelf: ['pallet', 'box'],              // длинномера на полках нет
  flow: ['pallet', 'box'],               // в поточном длинномера нет
  deep: ['pallet', 'box'],               // для длинномера в глубинном решений нет
  cantilever: ['long'],                  // консоль — только длинномер
  mezzanine: ['pallet', 'box', 'long'],
};

// Пояснения, которые показываем пользователю
export const RACK_NOTES = {
  cantilever: 'Консольные стеллажи работают только с длинномерным грузом и только с роботами FMR и CTU.',
  deep: 'Глубинное хранение: только паллеты и коробы, роботы CTU/FMR или стационарные системы.',
  shelf: 'Фронтально-полочные стеллажи не работают с длинномерным грузом. Тележки SR, собаки и гуманоиды не используются.',
  flow: 'Поточные стеллажи не работают с длинномерным грузом. Тележки SR, робособаки и гуманоиды не используются.',
  stack: 'Зона хранения: роботы заполняют её с нуля и не ездят по уже поставленному грузу. Тележки SR, робособаки и гуманоиды не используются.',
  mezzanine: 'Мезонин: только робособаки и гуманоиды.',
};

export const CARGO_ROBOTS = { long: ['CTU', 'FMR'] };   // длинномер: только с вилами
export const rackAllowsCargo = (rackType, cargoType) => !!RACK_CARGO[rackType]?.includes(cargoType);

// Список причин несовместимости (пустой массив = всё ок)
export function checkCompat(robot, rackType, cargo) {
  const why = [];
  if (!rackAllowsCargo(rackType, cargo.type)) why.push(`стеллаж «${RACK_TYPES[rackType]?.label}» не работает с этим типом груза`);
  if (!RACK_ROBOTS[rackType]?.includes(robot.type)) why.push(`${robot.type} не работает со стеллажом «${RACK_TYPES[rackType]?.label}»`);
  const allowed = CARGO_ROBOTS[cargo.type];
  if (allowed && !allowed.includes(robot.type)) why.push(`${robot.type} не работает с длинномерным грузом (нужны ${allowed.join('/')})`);
  if (cargo.unit.massKg > robot.payloadKg) why.push(`груз ${cargo.unit.massKg} кг тяжелее грузоподъёмности ${robot.type} (${robot.payloadKg} кг)`);
  return why;
}

// Минимальная рекомендуемая ширина прохода (м). Для роботов без вил — ширина + запас 0,4 м.
// Для вилочных (FMR, CTU) — по упрощённой формуле ширины прохода Ast: длина робота + длина груза + 0,3 м
// (для длинномера берём половину длины груза: он разворачивается боком).
export function minAisle(robot, cargo) {
  if (!['FMR', 'CTU'].includes(robot.type)) return +(robot.w + 0.4).toFixed(1);
  const load = cargo.type === 'long' ? cargo.unit.l * 0.5 : cargo.unit.l;
  return +(robot.l + load + 0.3).toFixed(1);
}
