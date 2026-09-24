// Справочники типов. Названия и цвета — только для отображения.
export const ROBOT_TYPES = {
  AMR:  { label: 'Автономный мобильный робот (AMR)',      color: '#3b82f6', shape: 'box' },
  UGV:  { label: 'Автономное наземное ТС (UGV)',          color: '#06b6d4', shape: 'box' },
  AGV:  { label: 'Автоматически управляемое ТС (AGV)',    color: '#f59e0b', shape: 'box' },
  MM:   { label: 'Мобильный манипулятор',                 color: '#8b5cf6', shape: 'manipulator' },
  SR:   { label: 'Робот SR: сортировочная тележка',       color: '#ec4899', shape: 'box' },
  DOG:  { label: 'Робот SR: робособака',                  color: '#f97316', shape: 'dog' },
  HUM:  { label: 'Робот SR: гуманоид',                    color: '#a855f7', shape: 'humanoid' },
  FMR:  { label: 'FMR (с вилами)',                        color: '#10b981', shape: 'forks' },
  CTU:  { label: 'CTU (с вилами)',                        color: '#14b8a6', shape: 'forks' },
  ASRS: { label: 'Стационарная роботизированная система', color: '#64748b', shape: 'stationary' },
};

// size — типовые габариты, если расчёт не прислал свои: w вдоль прохода, l — глубина (м).
// Для мезонина size — размер платформы.
export const RACK_TYPES = {
  stack:      { label: 'Горизонтальный/штабельный (зона хранения)', color: '#a3a3a3', size: { w: 2.7, l: 2.4 } },
  shelf:      { label: 'Фронтальный/полочный',                      color: '#94a3b8', size: { w: 2.7, l: 1.0 } },
  deep:       { label: 'Глубинный',                                 color: '#a8a29e', size: { w: 2.7, l: 6.0 } },
  flow:       { label: 'Поточный',                                  color: '#9ca3af', size: { w: 2.7, l: 5.0 } },
  cantilever: { label: 'Консольный',                                color: '#78716c', size: { w: 3.0, l: 1.6 } },
  mezzanine:  { label: 'Мезонин',                                   color: '#60a5fa', size: { w: 8.0, l: 6.0 } },
};

export const CARGO_TYPES = { pallet: 'Паллеты', box: 'Коробы / штучный груз', long: 'Длинномерный груз' };
export const PORT_COLORS = { in: '#16a34a', out: '#dc2626', inout: '#2563eb' };

// Типовые габариты стеллажного модуля (секции) в метрах по типу груза: w — вдоль прохода, l — глубина.
// Реальные ориентиры: паллета 1,2×0,8 м; фронтальная паллетная секция 2,7×1,1 м; полочный стеллаж под тоты 1,2×0,6 м;
// глубинный/поточный на 5 паллет вглубь ≈ 6 м; консоль — стойки через 3 м, плечи 1,5 м; длинномер до 6 м.
// Расчёт может прислать свои размеры в result.rack (w, l) — тогда используются они.
export const RACK_SIZES = {
  stack:      { pallet: { w: 2.7, l: 2.0 }, box: { w: 2.4, l: 1.2 }, long: { w: 6.6, l: 1.2 } },
  shelf:      { pallet: { w: 2.7, l: 1.1 }, box: { w: 1.2, l: 0.6 }, long: { w: 3.0, l: 1.5 } },
  deep:       { pallet: { w: 2.7, l: 6.0 }, box: { w: 1.6, l: 3.0 }, long: { w: 3.0, l: 6.0 } },
  flow:       { pallet: { w: 2.7, l: 6.0 }, box: { w: 1.2, l: 3.0 }, long: { w: 3.0, l: 6.0 } },
  cantilever: { pallet: { w: 3.0, l: 1.5 }, box: { w: 3.0, l: 1.5 }, long: { w: 3.0, l: 1.5 } },
  mezzanine:  { pallet: { w: 8.0, l: 6.0 }, box: { w: 8.0, l: 6.0 }, long: { w: 8.0, l: 6.0 } },
};
export const rackSize = (rack, cargo) => RACK_SIZES[rack]?.[cargo] ?? RACK_TYPES[rack]?.size ?? { w: 2.7, l: 1.0 };
