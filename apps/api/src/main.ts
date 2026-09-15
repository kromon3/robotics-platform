import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
async function bootstrap() {
  // REST API
  const port = process.env.PORT ?? 3000;
  const appRest = await NestFactory.create(AppModule);
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
