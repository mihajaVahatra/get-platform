import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { createProtectedUploadsRouter } from './common/middleware/protected-uploads.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Nécessaire pour vérifier la signature HMAC du webhook de paiement sur
    // les octets bruts envoyés par le fournisseur, plutôt que sur le JSON
    // re-sérialisé après transformation par class-validator/class-transformer.
    rawBody: true,
  });
  const configService = app.get(ConfigService);

  app.disable('x-powered-by');
  app.use((_, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    if (configService.get('NODE_ENV') === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  // CORS
  app.enableCors({
    origin: (
      configService.get('FRONTEND_URL') || 'http://localhost:3000'
    ).split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Documents/pièces jointes sensibles : servis via un routeur authentifié
  // (contrôle de propriété/rôle) qui redirige vers une URL S3 présignée à
  // courte durée de vie (voir StorageService/protected-uploads.middleware).
  // Les fichiers publics (avatars, logos, bannières) sont uploadés en accès
  // public directement sur le bucket S3 : ce backend ne les sert plus.
  app.use('/uploads', createProtectedUploadsRouter(app));

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filtres globaux
  app.useGlobalFilters(new AllExceptionsFilter());

  // Intercepteurs globaux
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(app.get(AuditInterceptor));

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
    .addServer(
      `http://localhost:${configService.get('PORT', 3001)}`,
      'Development',
    )
    .build();

  if (
    configService.get('NODE_ENV') !== 'production' ||
    configService.get('ENABLE_SWAGGER') === 'true'
  ) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });
  }

  const port = configService.get('PORT', 3001);
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
