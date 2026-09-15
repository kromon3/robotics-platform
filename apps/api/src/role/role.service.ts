import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany();
  }

  async findByName(name: string) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) {
      throw new NotFoundException(`Role "${name}" not found`);
    }
    return role;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((userRole) => userRole.role.name);
  }

  async assignRole(userId: string, roleName: string) {
    const role = await this.findByName(roleName);
    return this.prisma.userRole.create({
      data: { userId, roleId: role.id },
    });
  }

  async revokeRole(userId: string, roleName: string) {
    const role = await this.findByName(roleName);
    return this.prisma.userRole.deleteMany({
      where: { userId, roleId: role.id },
    });
  }
}
