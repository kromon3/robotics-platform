import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-auth.guard';
import { QuoteRequestsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';
import { QuoteNotifier } from './quote-notifier';
import { QuoteRateLimiter } from './rate-limiter';

@Module({
  imports: [UsersModule], // JwtAuthGuard достаёт пользователя через UsersService
  controllers: [QuoteRequestsController],
  providers: [
    QuoteRequestsService,
    QuoteNotifier,
    // Один лимитер на процесс: параметры по умолчанию из QUOTE_RATE_LIMIT
    { provide: QuoteRateLimiter, useFactory: () => new QuoteRateLimiter() },
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
})
export class QuoteRequestsModule {}
