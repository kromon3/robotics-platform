import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], // JwtAuthGuard достаёт пользователя через UsersService
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
