import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // HTTP security headers — prevents clickjacking, MIME sniffing, XSS, etc.
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for dev; enable in prod with proper directives
    crossOriginEmbedderPolicy: false,
  }));

  app.setGlobalPrefix('api/v1');

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-tenant-id', 'X-Tenant-ID'],
  });

  app.use(json({ limit: '100kb' }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Banking OS API is live on port: ${port}`);
  logger.log(`CORS enabled for: ${frontendUrl}`);
}

bootstrap();