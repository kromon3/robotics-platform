import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { QuoteRequestStatus } from '../../generated/prisma/enums';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';
import { QuoteRequestsQueryDto } from './dto/quote-requests-query.dto';
import { QuoteNotifier, formatQuoteNumber } from './quote-notifier';
import { QuoteRateLimiter } from './rate-limiter';

/** Редакция уведомления о ПДн, если клиент её не прислал */
export const DEFAULT_CONSENT_VERSION = '2026-10-17';

const DETAIL_INCLUDE = {
  suppliers: {
    orderBy: { companyName: 'asc' },
    include: { items: { orderBy: { productName: 'asc' } } },
  },
} satisfies Prisma.QuoteRequestInclude;

type QuoteWithSuppliers = Prisma.QuoteRequestGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/** Что видит отправитель после запроса: номер и кому уйдёт — без чужих данных */
export type QuoteReceipt = {
  id: string;
  number: number;
  displayNumber: string;
  status: QuoteRequestStatus;
  email: string;
  createdAt: Date;
  suppliers: {
    companyName: string;
    items: {
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: string | null;
    }[];
  }[];
};

type Product = {
  id: string;
  name: string;
  price: Prisma.Decimal | null;
  catalogVersion: number;
  companyId: string;
  company: { id: string; name: string };
};

/** Повторы одного решения складываем в одну позицию */
export function mergeItems(items: { productId: string; quantity: number }[]) {
  const byId = new Map<string, number>();
  for (const { productId, quantity } of items) {
    byId.set(productId, (byId.get(productId) ?? 0) + quantity);
  }
  return [...byId].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Позиции по поставщикам: каждый поставщик получает только свою часть */
export function groupBySupplier(
  items: { productId: string; quantity: number }[],
  products: Product[],
) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const groups = new Map<
    string,
    {
      companyId: string;
      companyName: string;
      items: { product: Product; quantity: number }[];
    }
  >();
  for (const { productId, quantity } of items) {
    const product = byId.get(productId);
    if (!product) continue;
    const group = groups.get(product.companyId) ?? {
      companyId: product.companyId,
      companyName: product.company.name,
      items: [],
    };
    group.items.push({ product, quantity });
    groups.set(product.companyId, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.companyName.localeCompare(b.companyName, 'ru'),
  );
}

const trimOrNull = (v?: string) => (v && v.trim() ? v.trim() : null);

@Injectable()
export class QuoteRequestsService {
  private readonly logger = new Logger(QuoteRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: QuoteNotifier,
    private readonly limiter: QuoteRateLimiter,
  ) {}

  async create(
    dto: CreateQuoteRequestDto,
    meta: { ip?: string; userId?: string | null },
  ): Promise<QuoteReceipt> {
    if (!this.limiter.take(meta.ip ?? 'unknown')) {
      throw new HttpException(
        'Слишком много запросов. Попробуйте через несколько минут.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const items = mergeItems(dto.items);
    const products: Product[] = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: {
        id: true,
        name: true,
        price: true,
        catalogVersion: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    });
    const missing = items.filter(
      (i) => !products.some((p) => p.id === i.productId),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Решения не найдены в каталоге: ${missing.map((i) => i.productId).join(', ')}`,
      );
    }

    // Ловушка сработала: отвечаем как обычно, но ничего не сохраняем и никому не отправляем
    if (dto.website && dto.website.trim()) {
      this.logger.warn(`Запрос КП отклонён как спам (ip ${meta.ip})`);
      return this.fakeReceipt(dto, items, products);
    }

    const suppliers = groupBySupplier(items, products);
    const created = await this.prisma.quoteRequest.create({
      data: {
        contactName: dto.contactName.trim(),
        company: dto.company.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: trimOrNull(dto.phone),
        inn: trimOrNull(dto.inn),
        comment: trimOrNull(dto.comment),
        deliveryRegion: dto.deliveryRegion.trim(),
        timeframe: dto.timeframe,
        consentGiven: true,
        consentAt: new Date(),
        consentVersion: dto.consentVersion ?? DEFAULT_CONSENT_VERSION,
        source: dto.source ?? null,
        userId: meta.userId ?? null,
        suppliers: {
          create: suppliers.map((s) => ({
            companyId: s.companyId,
            companyName: s.companyName,
            items: {
              create: s.items.map(({ product, quantity }) => ({
                productId: product.id,
                productName: product.name,
                unitPrice: product.price,
                catalogVersion: product.catalogVersion,
                quantity,
              })),
            },
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });

    // Отправка поставщикам не должна ронять приём запроса: он уже сохранён
    await this.notifier
      .notify({
        requestId: created.id,
        number: created.number,
        suppliers: created.suppliers.map((s) => ({
          companyId: s.companyId,
          companyName: s.companyName,
          items: s.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
          })),
        })),
      })
      .catch((error: Error) =>
        this.logger.error(
          `Не удалось уведомить поставщиков по КП-${formatQuoteNumber(created.number)}: ${error.message}`,
        ),
      );

    return toReceipt(created);
  }

  /** Список для администратора, новые сверху */
  async findAll(query: QuoteRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.QuoteRequestWhereInput = query.status
      ? { status: query.status }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.quoteRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: DETAIL_INCLUDE,
      }),
      this.prisma.quoteRequest.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const request = await this.prisma.quoteRequest.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!request) throw new NotFoundException('Запрос КП не найден');
    return request;
  }

  async updateStatus(id: string, status: QuoteRequestStatus) {
    await this.findOne(id);
    return this.prisma.quoteRequest.update({
      where: { id },
      data: { status },
      include: DETAIL_INCLUDE,
    });
  }

  private fakeReceipt(
    dto: CreateQuoteRequestDto,
    items: { productId: string; quantity: number }[],
    products: Product[],
  ): QuoteReceipt {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      number: 0,
      displayNumber: formatQuoteNumber(0),
      status: 'NEW',
      email: dto.email,
      createdAt: new Date(),
      suppliers: groupBySupplier(items, products).map((s) => ({
        companyName: s.companyName,
        items: s.items.map(({ product, quantity }) => ({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.price?.toString() ?? null,
        })),
      })),
    };
  }
}

export function toReceipt(request: QuoteWithSuppliers): QuoteReceipt {
  return {
    id: request.id,
    number: request.number,
    displayNumber: formatQuoteNumber(request.number),
    status: request.status,
    email: request.email,
    createdAt: request.createdAt,
    suppliers: request.suppliers.map((s) => ({
      companyName: s.companyName,
      items: s.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice?.toString() ?? null,
      })),
    })),
  };
}
