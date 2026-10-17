import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './auth.guard';

// Для публичных эндпоинтов, где вход необязателен (запрос КП от гостя):
// если пришёл валидный Bearer-токен — кладём пользователя в request.user,
// если токена нет или он просрочен — пропускаем как гостя, а не отвечаем 401.
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (!request.headers['authorization']) return true;
    try {
      await this.jwtGuard.canActivate(context);
    } catch {
      // Гость с протухшим токеном всё равно может отправить запрос
    }
    return true;
  }
}
