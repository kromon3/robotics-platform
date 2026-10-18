import { Injectable } from '@nestjs/common';

// Простейшая защита от спама без внешних зависимостей: не больше N запросов КП
// с одного IP за окно времени. Хранится в памяти процесса — при нескольких
// инстансах API лимит считается на каждом отдельно (для прототипа достаточно).

export const QUOTE_RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

@Injectable()
export class QuoteRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max = QUOTE_RATE_LIMIT.max,
    private readonly windowMs = QUOTE_RATE_LIMIT.windowMs,
  ) {}

  /** true — запрос можно принять (и он учтён), false — лимит исчерпан */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Не даём карте расти бесконечно: чистим ключи без свежих обращений
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }
}
