import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ComplianceUpdateDto } from './dto/compliance-update.dto';
import {
  ApplicationStatsQueryDto,
  ComplianceQueryDto,
  DateRangeQueryDto,
  ExportReportQueryDto,
  ReportsQueryDto,
} from './dto/ministry-query.dto';
import {
  ApplicationStatsDto,
  DashboardDto,
  SchoolStatsDto,
} from './dto/ministry-stats.dto';
import { ExportFormat, GenerateReportDto } from './dto/report-request.dto';
import { MinistryService } from './ministry.service';

@ApiTags('ministry')
@Controller('ministry')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MINISTRY', 'ADMIN_GET')
@ApiBearerAuth('access-token')
export class MinistryController {
  constructor(private readonly ministryService: MinistryService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Vue nationale agrégée, sans données personnelles étudiantes',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard agrégé récupéré',
    type: DashboardDto,
  })
  async getDashboard(@Query() query: DateRangeQueryDto) {
    const data = await this.ministryService.getDashboard(
      this.toDateRange(query),
    );
    return {
      success: true,
      data,
      message: 'Dashboard agrégé récupéré avec succès',
    };
  }

  @Get('stats/applications')
  @ApiOperation({
    summary:
      'Statistiques de candidatures agrégées par établissement et filière',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistiques de candidatures récupérées',
    type: ApplicationStatsDto,
  })
  async getApplicationStats(@Query() query: ApplicationStatsQueryDto) {
    const stats = await this.ministryService.getApplicationStats({
      ...this.toDateRange(query),
      region: query.region,
      filiere: query.filiere,
      schoolId: query.schoolId,
      limit: query.limit,
    });
    return {
      success: true,
      data: stats,
      message: 'Statistiques de candidatures récupérées avec succès',
    };
  }

  @Get('stats/schools')
  @ApiOperation({ summary: 'Statistiques agrégées des établissements' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistiques des établissements récupérées',
    type: SchoolStatsDto,
  })
  async getSchoolStats() {
    const stats = await this.ministryService.getSchoolStats();
    return {
      success: true,
      data: stats,
      message: 'Statistiques des établissements récupérées avec succès',
    };
  }

  @Get('stats/geographic')
  @ApiOperation({
    summary: 'Répartition géographique agrégée des étudiants, sans identité',
  })
  async getGeographicStats() {
    const data = await this.ministryService.getGeographicStats();
    return {
      success: true,
      data,
      message: 'Statistiques géographiques récupérées avec succès',
    };
  }

  @Get('compliance')
  @ApiOperation({
    summary: 'Liste paginée des contrôles de conformité par établissement',
  })
  async getCompliance(@Query() query: ComplianceQueryDto) {
    const result = await this.ministryService.getCompliance({
      status: query.status,
      page: query.page,
      limit: query.limit,
      latestOnly: query.latestOnly,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Contrôles de conformité récupérés avec succès',
    };
  }

  @Put('compliance/:schoolId')
  @ApiOperation({ summary: 'Enregistrer un contrôle de conformité' })
  @ApiParam({ name: 'schoolId', description: "Identifiant de l'établissement" })
  @ApiBody({ type: ComplianceUpdateDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Conformité mise à jour' })
  async updateCompliance(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() dto: ComplianceUpdateDto,
    @GetUser('id') userId: string,
  ) {
    const result = await this.ministryService.updateCompliance(
      schoolId,
      dto,
      userId,
    );
    return {
      success: true,
      data: result,
      message: 'Conformité mise à jour avec succès',
    };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Liste paginée des rapports agrégés générés' })
  async getReports(@Query() query: ReportsQueryDto) {
    const result = await this.ministryService.getReports(query);
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Rapports récupérés avec succès',
    };
  }

  @Post('reports/generate')
  @ApiOperation({
    summary: 'Générer un rapport agrégé ne contenant aucune donnée nominative',
  })
  @ApiBody({ type: GenerateReportDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Rapport généré',
  })
  async generateReport(
    @Body() dto: GenerateReportDto,
    @GetUser('id') userId: string,
  ) {
    const result = await this.ministryService.generateReport(dto, userId);
    return {
      success: true,
      data: result,
      message: 'Rapport agrégé généré avec succès',
    };
  }

  @Get('reports/:id')
  @ApiOperation({ summary: "Détail d'un rapport agrégé" })
  @ApiParam({ name: 'id', description: 'Identifiant du rapport' })
  async getReport(@Param('id', ParseUUIDPipe) id: string) {
    const report = await this.ministryService.getReport(id);
    return {
      success: true,
      data: report,
      message: 'Rapport récupéré avec succès',
    };
  }

  @Get('reports/:id/export')
  @ApiOperation({ summary: 'Télécharger un rapport agrégé' })
  @ApiParam({ name: 'id', description: 'Identifiant du rapport' })
  async exportReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ExportReportQueryDto,
  ) {
    const { buffer, contentType, extension } =
      await this.ministryService.exportReport(
        id,
        query.format ?? ExportFormat.PDF,
      );
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="rapport-${id}.${extension}"`,
    });
  }

  @Public()
  @Get('public/stats')
  @ApiOperation({
    summary: 'Statistiques nationales publiques et strictement agrégées',
  })
  async getPublicStats() {
    const dashboard = await this.ministryService.getDashboard();
    return {
      success: true,
      data: {
        totalSchools: dashboard.totalSchools,
        totalOffers: dashboard.totalOffers,
        totalApplications: dashboard.totalApplications,
        acceptanceRate: dashboard.acceptanceRate,
      },
      message: 'Statistiques publiques récupérées avec succès',
    };
  }

  private toDateRange(query: DateRangeQueryDto): {
    from?: Date;
    to?: Date;
  } {
    const from = query.from ? this.toBoundary(query.from, false) : undefined;
    const to = query.to ? this.toBoundary(query.to, true) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException(
        'La date de début doit être antérieure ou égale à la date de fin',
      );
    }

    return { from, to };
  }

  private toBoundary(value: string, endOfDay: boolean): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date invalide');
    }

    // Les champs HTML date transmettent YYYY-MM-DD. La borne haute doit
    // inclure toute la journée sélectionnée, pas uniquement minuit.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
      );
    }

    return date;
  }
}
