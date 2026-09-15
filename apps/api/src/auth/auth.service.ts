import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UserDto } from '../users/dto/user.dto';
import { LoginDto } from './dto/login.dto';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}
  async register(userDto: UserDto) {
    const newUser = await this.usersService.create(userDto);
    return this.buildAuthResponse(newUser.id);
  }
  async login(userDto: LoginDto) {
    const user = await this.usersService.getByEmail(userDto.email);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const isMatch = await bcrypt.compare(userDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return this.buildAuthResponse(user.id);
  }

  // Один формат ответа для register и login: пользователь без пароля, с ролями, плюс токен.
  // Роли нужны фронту сразу (бейдж ADMIN, доступ к админке), а не после отдельного /auth/me.
  private async buildAuthResponse(userId: string) {
    const user = await this.usersService.getById(userId);
    const { password, UserRole, ...userWithoutPassword } = user;
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      user: {
        ...userWithoutPassword,
        roles: UserRole.map((userRole) => userRole.role.name),
      },
      token,
    };
  }
}
