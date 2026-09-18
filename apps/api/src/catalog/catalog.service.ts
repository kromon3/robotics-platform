import {Injectable, NotFoundException} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsQueryDto } from './dto/products-query.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class CatalogService {
    constructor(private prisma: PrismaService) {}

    async getAllProducts(query: ProductsQueryDto) {
        const { type, status, category, industry, scenario, q, page, limit, sort } =
            query;

        // nulls: 'last' — товары без цены/УГТ в конец, а не в начало при desc
        const orderBy: Prisma.ProductOrderByWithRelationInput =
            sort === 'price_asc'
                ? { price: { sort: 'asc', nulls: 'last' } }
                : sort === 'price_desc'
                  ? { price: { sort: 'desc', nulls: 'last' } }
                  : sort === 'ugt_desc'
                    ? { ugt: { sort: 'desc', nulls: 'last' } }
                    : { name: 'asc' };
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
                orderBy,
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
    async getProductsById(id: string) {
        const robot = await this.prisma.product.findUnique({
            where: { id },
            include: {
                company: { select: { id: true, name: true, region: true, website: true } },
                productIndustries: { select: { industry: { select: { name: true } } } },
                productScenarios: { select: { scenario: { select: { name: true } } } },
                cases: { select: { id: true, description: true, customer: true, resultMetrics: true } },
            },
        });
        if (!robot) {
            throw new NotFoundException('Product not found');
        }
        return robot;
    }
    async getTotalItems() {
        const total = await this.prisma.product.count();
        return { total };
    }
}