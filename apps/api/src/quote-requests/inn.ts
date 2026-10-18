// Проверка ИНН по контрольным цифрам (алгоритм ФНС): 10 цифр — организация, 12 — ИП и физлицо.
// Тот же алгоритм — на фронтенде (apps/web/vite-project/src/lib/quote-form.ts).

const W10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const W11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const W12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

const checksum = (digits: number[], weights: number[]) =>
  (weights.reduce((sum, w, i) => sum + w * digits[i], 0) % 11) % 10;

export function isValidInn(value: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(value)) return false;
  const d = value.split('').map(Number);
  if (d.length === 10) return checksum(d, W10) === d[9];
  return checksum(d, W11) === d[10] && checksum(d, W12) === d[11];
}
