import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Fichiers statiques (uploads)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Validation globale
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Filtres globaux
  app.useGlobalFilters(new AllExceptionsFilter());

  // Intercepteurs globaux
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Préfixe API
  app.setGlobalPrefix('api');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('ERP GET API')
    .setDescription('API de la plateforme Grandes Écoles de Tananarive')
    .setVersion('1.0.0')
    .addTag('auth', '🔐 Authentification')
    .addTag('students', '👨‍🎓 Gestion des étudiants')
    .addTag('schools', '🏫 Gestion des écoles')
    .addTag('offers', '📝 Gestion des offres')
    .addTag('applications', '📨 Gestion des candidatures')
    .addTag('payments', '💳 Gestion des paiements')
    .addTag('ministry', '🏛️ Supervision Ministère')
    .addTag('notifications', '📨 Notifications')
    .addTag('audit', '📋 Audit')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez votre token JWT',
        in: 'header',
      },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .addServer(`http://localhost:${configService.get('PORT', 3001)}`, 'Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = configService.get('PORT', 3001);
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
