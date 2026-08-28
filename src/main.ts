import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './config/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  if (configService.get('NODE_ENV') !== 'production') {
    const origins = parseCorsOrigins(configService.get<string>('CORS_ORIGINS'));
    if (origins.length > 0) {
      app.enableCors({ origin: origins });
    }
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SAHAY API')
    .setDescription('SAHAY civic intelligence platform API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
}
void bootstrap();
