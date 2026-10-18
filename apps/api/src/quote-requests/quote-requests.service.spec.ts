import { BadRequestException } from '@nestjs/common';
import {
  QuoteRequestsService,
  groupBySupplier,
  mergeItems,
} from './quote-requests.service';
import { QuoteRateLimiter } from './rate-limiter';
import type { QuoteNotifier } from './quote-notifier';
import type { CreateQuoteRequestDto } from './dto/create-quote-request.dto';

const product = (
  id: string,
  companyId: string,
  companyName: string,
  price: string | null = '1000000',
) => ({
  id,
  name: `Робот ${id}`,
  price: price === null ? null : { toString: () => price },
  catalogVersion: 4,
  companyId,
  company: { id: companyId, name: companyName },
});

const PRODUCTS = [
  product('p1', 'c-ronavi', 'Ronavi Robotics'),
  product('p2', 'c-ronavi', 'Ronavi Robotics', null),
  product('p3', 'c-auto', 'Automacon'),
];

const dto = (
  over: Partial<CreateQuoteRequestDto> = {},
): CreateQuoteRequestDto => ({
  contactName: ' Иван Петров ',
  company: 'ООО «Склад»',
  email: 'Zakupki@Sklad.ru',
  deliveryRegion: 'Подольск',
  timeframe: '1-3m',
  consent: true,
  items: [
    { productId: 'p1', quantity: 2 },
    { productId: 'p3', quantity: 1 },
  ],
  ...over,
});

// То, что сервис передаёт в prisma.quoteRequest.create (нужные тесту поля)
type CreateData = {
  contactName: string;
  email: string;
  phone: string | null;
  inn: string | null;
  consentGiven: boolean;
  consentAt: Date;
  userId: string | null;
  suppliers: {
    create: {
      companyId: string;
      companyName: string;
      items: {
        create: { productId: string; productName: string; quantity: number }[];
      };
    }[];
  };
};

function setup() {
  const create = jest.fn(({ data }: { data: CreateData }) =>
    Promise.resolve({
      id: 'q1',
      number: 42,
      status: 'NEW',
      email: data.email,
      createdAt: new Date('2026-10-17T12:00:00Z'),
      suppliers: data.suppliers.create.map((s, i) => ({
        id: `s${i}`,
        companyId: s.companyId,
        companyName: s.companyName,
        items: s.items.create,
      })),
    }),
  );
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue(PRODUCTS) },
    quoteRequest: { create },
  };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const limiter = new QuoteRateLimiter(100, 60_000);
  const service = new QuoteRequestsService(
    prisma as never,
    notifier as unknown as QuoteNotifier,
    limiter,
  );
  /** Данные первого вызова create */
  const saved = () => create.mock.calls[0][0].data;
  return { prisma, notifier, limiter, service, saved };
}

describe('mergeItems / groupBySupplier', () => {
  it('повторы одного решения складываются', () => {
    expect(
      mergeItems([
        { productId: 'p1', quantity: 1 },
        { productId: 'p1', quantity: 2 },
      ]),
    ).toEqual([{ productId: 'p1', quantity: 3 }]);
  });

  it('позиции раскладываются по поставщикам, поставщики по алфавиту', () => {
    const groups = groupBySupplier(
      [
        { productId: 'p1', quantity: 1 },
        { productId: 'p3', quantity: 5 },
        { productId: 'p2', quantity: 2 },
      ],
      PRODUCTS as never,
    );
    expect(groups.map((g) => g.companyName)).toEqual([
      'Automacon',
      'Ronavi Robotics',
    ]);
    expect(groups[1].items.map((i) => i.product.id)).toEqual(['p1', 'p2']);
  });
});

describe('QuoteRequestsService.create', () => {
  it('сохраняет запрос с частями по поставщикам и снимком каталога', async () => {
    const { service, notifier, saved } = setup();
    const receipt = await service.create(
      dto({ phone: ' ', inn: '7707083893' }),
      {
        ip: '1.1.1.1',
        userId: null,
      },
    );

    const data = saved();
    expect(data.contactName).toBe('Иван Петров');
    expect(data.email).toBe('zakupki@sklad.ru');
    expect(data.phone).toBeNull();
    expect(data.inn).toBe('7707083893');
    expect(data.consentGiven).toBe(true);
    expect(data.consentAt).toBeInstanceOf(Date);
    expect(data.userId).toBeNull();
    expect(data.suppliers.create).toHaveLength(2);
    expect(data.suppliers.create[1]).toMatchObject({
      companyId: 'c-ronavi',
      companyName: 'Ronavi Robotics',
      items: {
        create: [
          {
            productId: 'p1',
            productName: 'Робот p1',
            quantity: 2,
            catalogVersion: 4,
          },
        ],
      },
    });

    expect(receipt.displayNumber).toBe('000042');
    expect(receipt.suppliers.map((s) => s.companyName)).toEqual([
      'Automacon',
      'Ronavi Robotics',
    ]);
    expect(receipt.suppliers[1].items[0].unitPrice).toBe('1000000');
    expect(notifier.notify).toHaveBeenCalledTimes(1);
    const [notification] = notifier.notify.mock.calls[0] as [
      { number: number; suppliers: unknown[] },
    ];
    expect(notification.number).toBe(42);
    expect(notification.suppliers).toHaveLength(2);
  });

  it('привязывает запрос к пользователю, если он вошёл', async () => {
    const { service, saved } = setup();
    await service.create(dto(), { ip: '1.1.1.1', userId: 'u1' });
    expect(saved().userId).toBe('u1');
  });

  it('неизвестное решение — 400 и ничего не сохраняется', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(dto({ items: [{ productId: 'nope', quantity: 1 }] }), {
        ip: '1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.quoteRequest.create).not.toHaveBeenCalled();
  });

  it('ловушка для ботов: ответ как обычно, но ничего не сохраняется и не отправляется', async () => {
    const { service, prisma, notifier } = setup();
    const receipt = await service.create(
      dto({ website: 'http://spam.example' }),
      { ip: '1' },
    );
    expect(receipt.number).toBe(0);
    expect(prisma.quoteRequest.create).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('лимит запросов с одного адреса — 429', async () => {
    const { service, limiter } = setup();
    jest.spyOn(limiter, 'take').mockReturnValueOnce(false);
    await expect(service.create(dto(), { ip: '1' })).rejects.toMatchObject({
      status: 429,
    });
    await expect(service.create(dto(), { ip: '1' })).resolves.toBeDefined();
  });

  it('сбой уведомления поставщиков не роняет приём запроса', async () => {
    const { service, notifier } = setup();
    notifier.notify.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.create(dto(), { ip: '1' })).resolves.toMatchObject({
      number: 42,
    });
  });
});
