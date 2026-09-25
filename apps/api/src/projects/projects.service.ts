import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

// В списке достаточно итогов и краткой карточки робота — без params/econ/norms
const LIST_SELECT = {
  id: true,
  name: true,
  objectType: true,
  robotsCount: true,
  capex: true,
  opexPerYear: true,
  annualEffect: true,
  paybackYears: true,
  roiPercent: true,
  tco: true,
  catalogVersion: true,
  modelVersion: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, name: true, specs: true, price: true } },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        userId,
        name: dto.name.trim(),
        objectType: dto.objectType ?? 'warehouse',
        params: dto.params as Prisma.InputJsonValue,
        econ: (dto.econ ?? undefined) as Prisma.InputJsonValue | undefined,
        norms: (dto.norms ?? undefined) as Prisma.InputJsonValue | undefined,
        productId: dto.productId ?? null,
        robotsCount: dto.robotsCount ?? null,
        capex: dto.capex ?? null,
        opexPerYear: dto.opexPerYear ?? null,
        annualEffect: dto.annualEffect ?? null,
        paybackYears: dto.paybackYears ?? null,
        roiPercent: dto.roiPercent ?? null,
        tco: dto.tco ?? null,
        catalogVersion: dto.catalogVersion ?? 4,
        modelVersion: dto.modelVersion ?? 'v2',
      },
      select: LIST_SELECT,
    });
  }

  /** Список расчётов пользователя, новые сверху */
  async findAll(userId: string) {
    const items = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: LIST_SELECT,
    });
    return { items, total: items.length };
  }

  /** Полный проект — с параметрами для восстановления формы */
  async findOne(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, specs: true, price: true, subtype: true, category: true } } },
    });
    if (!project) throw new NotFoundException('Расчёт не найден');
    // Проверка владения в сервисе, а не в гарде: guard не знает, чей это проект
    if (project.userId !== userId) throw new ForbiddenException('Это расчёт другого пользователя');
    return project;
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(userId, id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.objectType !== undefined ? { objectType: dto.objectType } : {}),
        ...(dto.params !== undefined ? { params: dto.params as Prisma.InputJsonValue } : {}),
        ...(dto.econ !== undefined ? { econ: dto.econ as Prisma.InputJsonValue } : {}),
        ...(dto.norms !== undefined ? { norms: dto.norms as Prisma.InputJsonValue } : {}),
        ...(dto.productId !== undefined ? { productId: dto.productId } : {}),
        ...(dto.robotsCount !== undefined ? { robotsCount: dto.robotsCount } : {}),
        ...(dto.capex !== undefined ? { capex: dto.capex } : {}),
        ...(dto.opexPerYear !== undefined ? { opexPerYear: dto.opexPerYear } : {}),
        ...(dto.annualEffect !== undefined ? { annualEffect: dto.annualEffect } : {}),
        ...(dto.paybackYears !== undefined ? { paybackYears: dto.paybackYears } : {}),
        ...(dto.roiPercent !== undefined ? { roiPercent: dto.roiPercent } : {}),
        ...(dto.tco !== undefined ? { tco: dto.tco } : {}),
      },
      select: LIST_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.project.delete({ where: { id } });
    return { id, deleted: true };
  }
}
