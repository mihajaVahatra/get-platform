import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformCityService } from './platform-city.service';
import {
  CreatePlatformCityDto,
  UpdatePlatformCityDto,
} from './dto/platform-city.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Contrôleur REST de gestion des villes de la plateforme (platform cities).
 * Ces villes servent de référentiel pour les sélecteurs de ville (ex : localisation
 * d'une école) et sont administrées uniquement par les comptes ADMIN_GET.
 */
@ApiTags('platform-cities')
@Controller('platform-cities')
export class PlatformCityController {
  constructor(private readonly platformCityService: PlatformCityService) {}

  /**
   * Liste toutes les villes de la plateforme.
   * Endpoint public (aucune authentification requise) car utilisé pour
   * peupler les sélecteurs de ville côté public.
   * @returns la liste des villes, triées par activité puis par nom.
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'List platform cities (used to populate city pickers)',
  })
  async findAll() {
    return { success: true, data: await this.platformCityService.findAll() };
  }

  /**
   * Crée une nouvelle ville.
   * Réservé aux administrateurs (rôle ADMIN_GET).
   * @param dto données de création (name, isActive).
   * @throws BadRequestException si le nom existe déjà.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a platform city (Admin only)' })
  async create(@Body() dto: CreatePlatformCityDto) {
    return { success: true, data: await this.platformCityService.create(dto) };
  }

  /**
   * Met à jour une ville existante (mise à jour partielle).
   * Réservé aux administrateurs (rôle ADMIN_GET).
   * @param id identifiant de la ville.
   * @param dto champs à modifier.
   * @throws NotFoundException si la ville n'existe pas.
   * @throws BadRequestException si le nouveau nom existe déjà.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a platform city (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdatePlatformCityDto) {
    return {
      success: true,
      data: await this.platformCityService.update(id, dto),
    };
  }

  /**
   * Supprime une ville.
   * Réservé aux administrateurs (rôle ADMIN_GET).
   * @param id identifiant de la ville.
   * @throws NotFoundException si la ville n'existe pas.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a platform city (Admin only)' })
  async remove(@Param('id') id: string) {
    await this.platformCityService.delete(id);
    return { success: true, message: 'Ville supprimée' };
  }
}
