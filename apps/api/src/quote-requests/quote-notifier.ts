import { Injectable, Logger } from '@nestjs/common';

// Точка, где запрос КП уходит поставщикам. Почтового или иного механизма уведомлений
// в проекте пока нет, поэтому здесь только журнал. Чтобы подключить отправку,
// замените реализацию notify (письмо поставщику, вебхук, задача в CRM) — контроллер
// и сервис менять не придётся. После реальной отправки стоит перевести часть
// поставщика в статус SENT и проставить sentAt.

export type QuoteNotification = {
  requestId: string;
  number: number;
  suppliers: {
    companyId: string | null;
    companyName: string;
    items: { productName: string; quantity: number }[];
  }[];
};

@Injectable()
export class QuoteNotifier {
  private readonly logger = new Logger(QuoteNotifier.name);

  notify(request: QuoteNotification): Promise<void> {
    for (const supplier of request.suppliers) {
      // TODO: отправить поставщику его часть запроса (адресат — см. открытые вопросы в PATCHNOTES)
      this.logger.log(
        `Запрос КП-${formatQuoteNumber(request.number)} → ${supplier.companyName}: ` +
          supplier.items
            .map((i) => `${i.productName} × ${i.quantity}`)
            .join('; '),
      );
    }
    return Promise.resolve();
  }
}

/** 42 → 000042: номер запроса для людей */
export const formatQuoteNumber = (n: number) => String(n).padStart(6, '0');
