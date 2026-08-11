import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { createProtectedUploadsRouter } from '../../src/common/middleware/protected-uploads.middleware';

/**
 * Bootstrap d'app e2e répliquant les éléments de src/main.ts dont dépendent
 * les parcours testés (préfixe /api, ValidationPipe, routeur /uploads) —
 * sans Swagger ni écoute réseau réelle, supertest appelle directement le
 * handler HTTP en mémoire.
 *
 * @param configureModule Optionnel : permet de surcharger un provider avant
 * compilation (ex. remplacer le PaymentProvider aléatoire — 10% d'échec
 * simulé — par un double déterministe, sans quoi le test paiement serait
 * intrinsèquement flaky). Tout le reste de l'app (DB, guards, HTTP) reste réel.
 */
export async function bootstrapTestApp(
  configureModule?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (configureModule) {
    builder = configureModule(builder);
  }
  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use('/uploads', createProtectedUploadsRouter(app));
  app.setGlobalPrefix('api');

  await app.init();
  return app;
}
