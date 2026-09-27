// Слияние листа «Каталог» от робототехников (robots-sheet.csv) с robot-specs.json.
//
// Матчим ПО НАЗВАНИЮ, а не по id: в v2 карточки перенумерованы (в v1 R-123 = «Сёмабот»,
// в v2 R-123 = «DMR Carrier P»), а наши фото лежат как <catalogId>.<ext> и колонка «Фото»
// в листе не заполнена. Совпавшим обновляем ТТХ, свой id и фото сохраняем; новых добавляем
// со свободными id; записи v1, которых в v2 нет, не трогаем — их просто не переносили.
//
// Запуск: node prisma/tools/merge-sheet.js [--write]

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const SHEET = path.join(DATA, 'robots-sheet.csv');
const SPECS = path.join(DATA, 'robot-specs.json');

// Кириллические омоглифы -> латиница: «АК-2000» и «AK-2000» должны совпасть (как в seed-specs.ts)
const HOMO = { а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x' };
const key = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .split('')
    .map((c) => HOMO[c] ?? c)
    .join('');

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return v === '' || v === undefined || Number.isNaN(n) ? undefined : n; };
const str = (v) => (v === '' || v === undefined ? undefined : String(v));

// Лист -> specs веб-сервиса. Ключи те же, что в «Словаре полей».
function toSpecs(r) {
  const s = {
    robot_type: str(r.robot_type),
    payload_kg: num(r.payload_kg),
    length_mm: num(r.platform_l_mm),
    width_mm: num(r.platform_w_mm),
    height_mm: num(r.platform_h_mm),
    lift_height_mm: num(r.lift_height_mm),
    lift_residual_payload_kg: num(r.lift_residual_payload_kg),
    table_lift_height_mm: num(r.table_lift_height_mm),
    slope_pct: num(r.slope_pct),
    cargo_long_mm: num(r.cargo_long_mm),
    cargo_pallet_l_mm: num(r.cargo_pallet_l_mm),
    cargo_pallet_w_mm: num(r.cargo_pallet_w_mm),
    cargo_custom_l_mm: num(r.cargo_custom_l_mm),
    cargo_custom_w_mm: num(r.cargo_custom_w_mm),
    cargo_box_l_mm: num(r.cargo_box_l_mm),
    cargo_box_w_mm: num(r.cargo_box_w_mm),
    positioning_mm: num(r.positioning_mm),
    gripper: str(r.gripper),
    gripper_extra: str(r.gripper_extra),
    runtime_h: num(r.runtime_h),
    range_km: num(r.range_km),
    speed_mps: num(r.speed_mps),
    charge_h: num(r.charge_h),
    warehouse_height_m: num(r.warehouse_height_m),
    lift_drive: str(r.lift_drive),
    battery: str(r.battery),
    mass_kg: num(r.mass_kg),
    navigation: str(r.navigation),
    fork_length_mm: num(r.fork_length_mm),
    throughput_units_per_h: num(r.throughput_per_hour),
    manufacturer: str(r.manufacturer),
    country: str(r.country),
    availability: str(r.availability),
    sheet_id: str(r.id), // id карточки в листе — чтобы найти строку у робототехников
    // Примечание поставщика данных: как правило, оговорка к цене («FOB $15–17 тыс.,
    // в каталоге оценка landed РФ») — показываем пользователю рядом с ценой
    note: str(r.note),
  };
  for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
  return s;
}

const sheet = parseCsv(fs.readFileSync(SHEET, 'utf8'));
const specs = JSON.parse(fs.readFileSync(SPECS, 'utf8'));
const byName = new Map(specs.map((r) => [key(r.name), r]));

// Свободные id для новых карточек — после максимального нашего
const maxId = Math.max(...specs.map((r) => Number(String(r.catalogId).replace(/\D/g, '')) || 0));
let nextId = maxId + 1;

const log = { updated: [], added: [], untouched: [], fieldsAdded: {}, photos: [] };

// Фотографии из архива поставщика данных названы по ЕГО id карточки (R-213.jpg),
// а у нас свои — поэтому файл копируется под нашим именем. Уже имеющиеся фото не трогаем:
// они подобраны раньше и частью переведены в webp.
const PHOTOS_DIR = (() => {
  const i = process.argv.indexOf('--photos');
  return i > 0 ? process.argv[i + 1] : null;
})();
const PHOTOS_OUT = path.join(DATA, 'photos');

function takePhoto(row, catalogId, hasPhoto) {
  if (!PHOTOS_DIR || hasPhoto || !row.photo) return null;
  const src = path.join(PHOTOS_DIR, row.photo);
  if (!fs.existsSync(src)) return null;
  const name = catalogId + path.extname(row.photo).toLowerCase();
  fs.copyFileSync(src, path.join(PHOTOS_OUT, name));
  log.photos.push(`${row.photo} -> ${name}`);
  return name;
}

for (const row of sheet) {
  const fresh = toSpecs(row);
  const existing = byName.get(key(row.name));

  if (existing) {
    const before = Object.keys(existing.specs ?? {});
    // ТТХ из листа считаем более свежими; фото и catalogId — наши
    existing.specs = { ...existing.specs, ...fresh };
    existing.manufacturer = str(row.manufacturer) ?? existing.manufacturer;
    existing.priceRub = num(row.price_rub) ?? existing.priceRub;
    existing.sourceUrl = str(row.source_url) ?? existing.sourceUrl;
    existing.sourceDate = str(row.data_date) ?? existing.sourceDate;
    existing.verified = row.verified === 'Да';
    existing.photo = existing.photo ?? takePhoto(row, existing.catalogId, Boolean(existing.photo));
    const added = Object.keys(fresh).filter((k) => !before.includes(k));
    added.forEach((k) => (log.fieldsAdded[k] = (log.fieldsAdded[k] ?? 0) + 1));
    log.updated.push(`${existing.catalogId} ${existing.name}${added.length ? ' (+' + added.length + ' полей)' : ''}`);
  } else {
    const catalogId = `R-${nextId++}`;
    specs.push({
      catalogId,
      name: row.name,
      manufacturer: str(row.manufacturer) ?? null,
      priceRub: num(row.price_rub) ?? null,
      photo: takePhoto(row, catalogId, false),
      sourceUrl: str(row.source_url) ?? null,
      sourceDate: str(row.data_date) ?? null,
      verified: row.verified === 'Да',
      specs: fresh,
    });
    log.added.push(`${catalogId} ${row.name} (лист ${row.id})`);
  }
}

log.untouched = specs.filter((r) => !sheet.some((row) => key(row.name) === key(r.name))).map((r) => `${r.catalogId} ${r.name}`);

console.log(`Обновлено: ${log.updated.length}`);
log.updated.forEach((s) => console.log('  ' + s));
console.log(`\nДобавлено: ${log.added.length}`);
log.added.forEach((s) => console.log('  ' + s));
console.log(`\nНе тронуто (нет в листе v2): ${log.untouched.length}`);
console.log(`\nНовые поля ТТХ:`);
Object.entries(log.fieldsAdded).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(28)} ${n}`));
console.log(`\nСкопировано фотографий: ${log.photos.length}`);
console.log(`\nИтого карточек: ${specs.length}, с фото: ${specs.filter((r) => r.photo).length}`);

if (process.argv.includes('--write')) {
  fs.writeFileSync(SPECS, JSON.stringify(specs, null, 2) + '\n', 'utf8');
  console.log('\nrobot-specs.json перезаписан');
} else {
  console.log('\nЭто предпросмотр. Записать: node prisma/tools/merge-sheet.js --write');
}
