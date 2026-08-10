import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CompetitionService } from './competition.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Expose les endpoints CRUD des concours d'admission. Tout le contrôleur est réservé
 * au rôle ADMIN_GET (guard/rôle déclarés au niveau classe, appliqués à toutes les routes).
 */
@ApiTags('competitions')
@ApiBearerAuth()
@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  /** Liste paginée des concours, avec filtres optionnels par école, statut et recherche textuelle sur le nom. */
  @Get()
  @ApiOperation({ summary: 'List competitions' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.competitionService.findAll(
      Number(page) || 1,
      Number(limit) || 20,
      { schoolId, status, search },
    );
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Competitions retrieved successfully',
    };
  }

  /** Crée un nouveau concours pour une école (et éventuellement un programme précis). */
  @Post()
  @ApiOperation({ summary: 'Create a competition' })
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitionService.create(dto);
  }

  /**
   * Met à jour un concours existant.
   * @throws {NotFoundException} Si le concours n'existe pas (ou a été supprimé).
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a competition' })
  update(@Param('id') id: string, @Body() dto: UpdateCompetitionDto) {
    return this.competitionService.update(id, dto);
  }

  /**
   * Supprime un concours (suppression logique via `deletedAt`, pas de suppression physique).
   * @throws {NotFoundException} Si le concours n'existe pas (ou a déjà été supprimé).
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a competition' })
  remove(@Param('id') id: string) {
    return this.competitionService.delete(id);
  }
}
