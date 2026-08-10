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
import { FeeBracketService } from './fee-bracket.service';
import {
  CreateFeeBracketDto,
  UpdateFeeBracketDto,
} from './dto/fee-bracket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Contrôleur REST de gestion des tranches de frais (fee brackets).
 * Ces tranches servent de filtre de recherche pour les offres de formation
 * et sont administrées uniquement par les comptes ADMIN_GET.
 */
@ApiTags('fee-brackets')
@Controller('fee-brackets')
export class FeeBracketController {
  constructor(private readonly feeBracketService: FeeBracketService) {}

  /**
   * Liste toutes les tranches de frais existantes.
   * Endpoint public (aucune authentification requise) car utilisé pour
   * peupler le filtre de frais sur la page publique des offres.
   * @returns la liste des tranches, triées par activité/ordre/montant min.
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'List fee brackets (used to populate the offers fee filter)',
  })
  async findAll() {
    return { success: true, data: await this.feeBracketService.findAll() };
  }

  /**
   * Crée une nouvelle tranche de frais.
   * Réservé aux administrateurs (rôle ADMIN_GET).
   * @param dto données de création (label, minFees, maxFees, sortOrder, isActive).
   * @throws BadRequestException si le range min/max est invalide ou si le label existe déjà.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a fee bracket (Admin only)' })
  async create(@Body() dto: CreateFeeBracketDto) {
    return { success: true, data: await this.feeBracketService.create(dto) };
  }

  /**
   * Met à jour une tranche de frais existante (mise à jour partielle).
   * Réservé aux administrateurs (rôle ADMIN_GET).
   * @param id identifiant de la tranche.
   * @param dto champs à modifier.
   * @throws NotFoundException si la tranche n'existe pas.
   * @throws BadRequestException si le range min/max devient invalide ou si le nouveau label existe déjà.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a fee bracket (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateFeeBracketDto) {
    return {
      success: true,
      data: await this.feeBracketService.update(id, dto),
    };
  }

  /**
   * Supprime une tranche de frais.
   * Réservé aux administrateurs (rôle ADMIN_GET).
   * @param id identifiant de la tranche.
   * @throws NotFoundException si la tranche n'existe pas.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a fee bracket (Admin only)' })
  async remove(@Param('id') id: string) {
    await this.feeBracketService.delete(id);
    return { success: true, message: 'Tranche de frais supprimée' };
  }
}
