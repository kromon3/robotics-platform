import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!request.user.roles?.includes('ADMIN')) {
      throw new ForbiddenException(
        'Only administrators can access this resource',
      );
    }
    return true;
  }
}
