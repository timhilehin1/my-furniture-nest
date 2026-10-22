import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');  
  app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const first = errors[0];
        const message =
          Object.values(first.constraints ?? {})[0] ?? 'Invalid input';
        return new BadRequestException(message);
      },
    }),
  );
  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle('My-furniture-backend')
    .setDescription('Nest Js backend docs for my furniture storefront')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
