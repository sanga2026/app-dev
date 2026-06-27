import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { json } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 🚀Tell NestJS to prefix every single route with /api/v1
  app.setGlobalPrefix('api/v1');

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // 🚀 1. DYNAMIC ORIGIN: Reads from deployment environment, defaults to localhost for dev
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

  // --- 2. THE SECURITY BRIDGE (CORS) ---
  // Principle: Security-First. 
  app.enableCors({
    origin: frontendUrl, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    // 🚀 CRITICAL: x-tenant-id must be here so your Angular Interceptor isn't blocked!
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-tenant-id', 'X-Tenant-ID'],
  });

  // 🚀 3. Protect against massive JSON payloads
  app.use(json({ limit: '100kb' }));
  
  // --- 4. THE DATA FILTER (Global Validation) ---
  // Principle: High Performance (Fail-fast), Clean Core.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // Strips away any properties not in your DTO
    forbidNonWhitelisted: true, // Optional but recommended: Throws an error if they send extra random data
    transform: true,       // Converts plain JS objects to DTO classes
    stopAtFirstError: true // Improves performance by stopping at the first error
  }));

  // --- 5. DYNAMIC PORT BINDING ---
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 MindSpark OS Core Vault API is live on port: ${port}`);
  logger.log(`🛡️  CORS enabled strictly for: ${frontendUrl}`);
}

bootstrap();