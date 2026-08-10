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
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

/** Expose les endpoints CRUD des années scolaires. Consultation publique, écriture réservée à ADMIN_GET. */
@ApiTags('academic-years')
@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  /** Liste toutes les années scolaires (triées par date de début décroissante). Accès public. */
  @Public()
  @Get()
  @ApiOperation({ summary: 'List academic years (used by school admins to plan schedules)' })
  async findAll() {
    return { success: true, data: await this.academicYearService.findAll() };
  }

  /**
   * Crée une nouvelle année scolaire. Réservé au rôle ADMIN_GET.
   * @throws {BadRequestException} Si les dates sont incohérentes ou le libellé déjà pris.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an academic year (Admin only)' })
  async create(@Body() dto: CreateAcademicYearDto) {
    return { success: true, data: await this.academicYearService.create(dto) };
  }

  /**
   * Met à jour une année scolaire existante. Réservé au rôle ADMIN_GET.
   * @throws {NotFoundException} Si l'année scolaire n'existe pas.
   * @throws {BadRequestException} Si les dates sont incohérentes ou le libellé déjà pris.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an academic year (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAcademicYearDto) {
    return { success: true, data: await this.academicYearService.update(id, dto) };
  }

  /**
   * Supprime une année scolaire. Réservé au rôle ADMIN_GET.
   * @throws {NotFoundException} Si l'année scolaire n'existe pas.
   * @throws {BadRequestException} Si des classes utilisent encore cette année scolaire.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete an unused academic year (Admin only)' })
  async remove(@Param('id') id: string) {
    await this.academicYearService.delete(id);
    return { success: true, message: 'Année scolaire supprimée' };
  }
}
