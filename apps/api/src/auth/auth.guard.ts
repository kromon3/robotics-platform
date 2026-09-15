import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Токен не предоставлен');
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Неверный формат токена');
    }

    let payload: JwtPayload;
    try {
      // Секрет и алгоритм берутся из JwtModule — один источник конфига.
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch (error) {
      this.logger.debug(`Ошибка проверки JWT: ${error.message}`);
      throw new UnauthorizedException('Невалидный или просроченный токен');
    }

    const user = await this.usersService.getById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    const requestUser: RequestUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.UserRole.map((userRole) => userRole.role.name),
    };
    request.user = requestUser;
    return true;
  }
}
