import { Module } from '@nestjs/common';
import { PlatformCityService } from './platform-city.service';
import { PlatformCityController } from './platform-city.controller';
import { PrismaModule } from '../prisma/prisma.module';

/** Module NestJS regroupant le contrôleur et le service des villes de la plateforme. */
@Module({
  imports: [PrismaModule],
  controllers: [PlatformCityController],
  providers: [PlatformCityService],
  exports: [PlatformCityService],
})
export class PlatformCityModule {}
