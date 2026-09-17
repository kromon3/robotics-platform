import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsQueryDto } from './dto/products-query.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async getAllProducts(query: ProductsQueryDto) {
    const { type, status, category, industry, scenario, q, page, limit } =
      query;
    const where: Prisma.ProductWhereInput = {
      type,
      status,
      category,
      name: q ? { contains: q, mode: 'insensitive' } : undefined,
      productIndustries: industry
        ? { some: { industry: { name: industry } } }
        : undefined,
      productScenarios: scenario
        ? { some: { scenario: { name: scenario } } }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { company: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
