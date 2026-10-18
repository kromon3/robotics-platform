import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { ADMIN_ROOT, setupAdmin } from './admin/admin';
async function bootstrap() {
  // REST API
  const port = process.env.PORT ?? 3000;
  const appRest = await NestFactory.create<NestExpressApplication>(AppModule);
  // За nginx реальный IP клиента приходит в X-Forwarded-For. Без trust proxy лимит запросов КП
  // (src/quote-requests/rate-limiter.ts) считался бы на один адрес прокси для всех пользователей.
  // Включается переменной TRUST_PROXY (число доверенных прокси), см. docker-compose.yml.
  if (process.env.TRUST_PROXY) {
    appRest.set(
      'trust proxy',
      Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY,
    );
  }

  // Фото роботов из каталога ТТХ: prisma/data/photos/R-101.webp -> /photos/R-101.webp
  // В dist лежит рядом (prisma копируется в образ), в dev — на два уровня выше от src
  appRest.useStaticAssets(join(__dirname, '..', '..', 'prisma', 'data', 'photos'), {
    prefix: '/photos/',
    maxAge: '7d',
  });
  const config = new DocumentBuilder()
    .setTitle('Robotics Platform API')
    .setDescription('Платформа подбора роботизированных решений: авторизация, каталог, проекты, расчёты')
    .addBearerAuth()
    .setVersion('1.0')
    .addTag('Auth')
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(appRest as any, config);
  SwaggerModule.setup('docs', appRest as any, documentFactory);
  appRest.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  appRest.enableCors();

  // AdminJS монтируется до listen: свой роутер, своя сессия, ValidationPipe его не трогает
  await setupAdmin(appRest);

  await appRest.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server is running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  console.log(`🛠️  Admin panel: http://localhost:${port}${ADMIN_ROOT}`);
}
bootstrap();
