// AdminJS v7 — ESM-only, а Nest собирается в CommonJS: tsc превращает import() в require(),
// и загрузка падает с ERR_REQUIRE_ESM. Обёртка через Function сохраняет настоящий
// динамический import, который TypeScript не трогает.
export const importESM = new Function(
  'specifier',
  'return import(specifier)',
) as <T = unknown>(specifier: string) => Promise<T>;
