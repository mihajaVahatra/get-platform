import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma partagé, injecté dans tous les services ayant besoin d'accéder à la
 * base PostgreSQL. Gère la connexion/déconnexion en phase avec le cycle de vie du
 * module Nest et active la journalisation détaillée des requêtes en développement.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  /** Établit la connexion à la base de données au démarrage du module. */
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected to PostgreSQL');
  }

  /** Ferme proprement la connexion à la base de données à l'arrêt du module. */
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔴 Prisma disconnected from PostgreSQL');
  }
}
