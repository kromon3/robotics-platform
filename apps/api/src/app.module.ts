import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RoleModule } from './role/role.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    RoleModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
