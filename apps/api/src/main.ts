import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
async function bootstrap() {
  // REST API
  const port = process.env.PORT ?? 3000;
  const appRest = await NestFactory.create<NestExpressApplication>(AppModule);

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
  await appRest.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server is running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/docs`);
}
bootstrap();
