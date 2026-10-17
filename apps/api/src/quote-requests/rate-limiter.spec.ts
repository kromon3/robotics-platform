import { QuoteRateLimiter } from './rate-limiter';

describe('QuoteRateLimiter', () => {
  it('пропускает не больше max запросов за окно с одного адреса', () => {
    const limiter = new QuoteRateLimiter(2, 1000);
    expect(limiter.take('1.1.1.1', 0)).toBe(true);
    expect(limiter.take('1.1.1.1', 10)).toBe(true);
    expect(limiter.take('1.1.1.1', 20)).toBe(false);
    // Другой адрес считается отдельно
    expect(limiter.take('2.2.2.2', 20)).toBe(true);
  });

  it('после окна снова пропускает', () => {
    const limiter = new QuoteRateLimiter(1, 1000);
    expect(limiter.take('ip', 0)).toBe(true);
    expect(limiter.take('ip', 999)).toBe(false);
    expect(limiter.take('ip', 1000)).toBe(true);
  });
});
