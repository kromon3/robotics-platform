// Редактор key-value в AdminJS отдаёт jsonb-поле плоскими ключами: specs.payload_kg, specs.photo…
// @adminjs/sql передаёт их в knex как есть, и Postgres отвечает
// «cannot assign to field of column because its type jsonb is not a composite type».
// Точки в именах колонок здесь не встречаются, поэтому любой ключ с точкой — это путь внутрь JSON.

/** "1600" -> 1600, "true" -> true; всё остальное остаётся строкой */
export function parseScalar(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  // Только простые числа: артикулы вида R-120 или версии 1.2.3 остаются строками
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

/** Записывает значение по пути ['specs','payload_kg'] внутрь target */
function setPath(target: Record<string, unknown>, path: string[], value: unknown) {
  let node = target;
  for (const key of path.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1]] = value;
}

/**
 * Собирает ключи вида `specs.payload_kg` в объект `specs`.
 * Значение самого поля, если пришло объектом, берётся за основу — так правка одного ключа
 * не стирает остальные ТТХ. Возвращает новый объект, исходный не меняется.
 */
export function unflattenDotted(params: Record<string, unknown>): Record<string, unknown> {
  const dotted = Object.keys(params).filter((key) => key.includes('.'));
  if (dotted.length === 0) return params;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.includes('.')) result[key] = value;
  }

  for (const key of dotted) {
    const [field, ...rest] = key.split('.');
    if (typeof result[field] !== 'object' || result[field] === null) {
      const original = params[field];
      result[field] =
        typeof original === 'object' && original !== null ? { ...(original as object) } : {};
    }
    setPath(result[field] as Record<string, unknown>, rest, parseScalar(params[key]));
  }

  return result;
}
