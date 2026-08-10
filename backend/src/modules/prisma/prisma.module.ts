import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Module global exposant `PrismaService` à toute l'application sans avoir à
 * l'importer explicitement dans chaque module consommateur (`@Global()`).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
