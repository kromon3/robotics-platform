import { ConflictException, Injectable } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

const DEFAULT_ROLE_NAME = 'USER';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
  ) {}
  async create(userDto: UserDto) {
    // Явная проверка вместо ловли P2002: даёт 409 с понятным текстом, а не 500 на форме регистрации.
    const [byEmail, byName] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: userDto.email }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { name: userDto.name }, select: { id: true } }),
    ]);
    if (byEmail) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }
    if (byName) {
      throw new ConflictException('Это имя пользователя уже занято');
    }

    return this.prisma.$transaction(async (tx) => {
      const saltRounds = 10;
      const hash = await bcrypt.hash(userDto.password, saltRounds);
      const userDtoHashPassword = {
        ...userDto,
        password: hash,
      };
      const user = await tx.user.create({
        data: userDtoHashPassword,
      });
      const defaultRole = await tx.role.findUniqueOrThrow({
        where: { name: DEFAULT_ROLE_NAME },
      });
      await tx.userRole.create({
        data: { userId: user.id, roleId: defaultRole.id },
      });
      return user;
    });
  }

  async getAll() {
    return this.prisma.user.findMany();
  }

  async getById(id: string) {
    return this.prisma.user.findUnique({
      where: { id: id },
      include: { UserRole: { include: { role: true } } },
    });
  }

  async getByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email } });
  }

  async update(userDto: UpdateUserDto, id: string) {
    const data = { ...userDto };
    if (data.password) {
      const saltRounds = 10;
      data.password = await bcrypt.hash(data.password, saltRounds);
    }
    const updateUser = await this.prisma.user.update({
      where: {
        id: id,
      },
      data,
    });
    return updateUser;
  }

  async deleteById(id: string) {
    return this.prisma.user.delete({
      where: {
        id: id,
      },
    });
  }
}
