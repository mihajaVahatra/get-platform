import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
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

  // Render (et la plupart des PaaS) placent le service derrière un reverse
  // proxy : sans ceci, `req.ip` vaut l'IP du proxy pour toutes les requêtes,
  // ce qui fait retomber le rate limiting (par IP) sur une IP unique
  // partagée par tout le trafic entrant plutôt que par client réel.
  // `1` = faire confiance au premier hop devant l'app (le proxy Render),
  // pas à un X-Forwarded-For arbitraire fourni par le client.
  if (configService.get('TRUST_PROXY') === 'true') {
    app.set('trust proxy', 1);
  }

  // Sonde de démarrage de la plateforme d'hébergement (ex: Render fait un
  // HEAD / avant de déclarer le service "Live") — en dehors du préfixe
  // global /api, donc traité en middleware Express brut plutôt que via un
  // contrôleur Nest.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      request.path === '/' &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      response.status(200).send('OK');
      return;
    }
    next();
  });

  app.use((_: Request, response: Response, next: NextFunction) => {
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
  const allowedOrigins = (
    configService.get('FRONTEND_URL') || 'http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Anti-CSRF : CORS empêche un site tiers de LIRE la réponse d'une requête
  // cross-site, mais pas de la DÉCLENCHER (un <form> ou une image cross-site
  // envoie quand même la requête, cookies compris, sans préflight ni lecture
  // de réponse nécessaires). C'est sans conséquence tant que les cookies de
  // session sont SameSite=Lax (défaut, voir AuthController.setSessionCookies),
  // mais devient exploitable dès que CROSS_SITE_COOKIES=true bascule les
  // cookies en SameSite=None pour les déploiements multi-domaines. On
  // vérifie donc explicitement Origin (repli sur Referer si absent) contre
  // FRONTEND_URL pour toute méthode qui modifie l'état ; une requête sans
  // aucun des deux en-têtes n'est pas un scénario de navigateur exploitable
  // par CSRF (curl, mobile, server-to-server) et reste autorisée. Les
  // webhooks de paiement sont exclus : appelés serveur à serveur par le
  // prestataire, sans cookie, déjà authentifiés par leur propre signature
  // (HMAC maison pour /webhook, Stripe-Signature native pour
  // /webhook/stripe — voir PaymentService).
  const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const PAYMENT_WEBHOOK_PATHS = new Set([
    '/api/payments/webhook',
    '/api/payments/webhook/stripe',
  ]);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      !MUTATING_METHODS.has(request.method) ||
      PAYMENT_WEBHOOK_PATHS.has(request.path)
    ) {
      return next();
    }

    const originHeader = request.headers.origin;
    const refererHeader = request.headers.referer;
    let candidate: string | undefined = originHeader;
    if (!candidate && refererHeader) {
      try {
        candidate = new URL(refererHeader).origin;
      } catch {
        candidate = undefined;
      }
    }

    if (!candidate) {
      return next();
    }

    if (!allowedOrigins.includes(candidate)) {
      response.status(403).json({ message: 'Origine de la requête refusée' });
      return;
    }
    next();
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
