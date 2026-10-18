import { isValidInn } from './inn';

describe('isValidInn', () => {
  it('принимает ИНН организации и ИП с верной контрольной суммой', () => {
    expect(isValidInn('7707083893')).toBe(true); // 10 цифр — организация
    expect(isValidInn('500100732259')).toBe(true); // 12 цифр — ИП / физлицо
  });

  it('отклоняет неверную контрольную сумму, длину и не цифры', () => {
    expect(isValidInn('7707083894')).toBe(false);
    expect(isValidInn('500100732258')).toBe(false);
    expect(isValidInn('77070838')).toBe(false);
    expect(isValidInn('77070838ab')).toBe(false);
    expect(isValidInn('')).toBe(false);
  });
});
