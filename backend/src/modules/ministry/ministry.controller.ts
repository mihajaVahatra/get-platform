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

/**
 * Expose les endpoints de supervision nationale du ministère : tableaux de
 * bord et statistiques agrégées, suivi de conformité des établissements et
 * génération/export de rapports. Toutes les routes sont réservées aux rôles
 * MINISTRY et ADMIN_GET (sauf `public/stats`, volontairement publique) et
 * ne renvoient jamais de données nominatives sur les étudiants.
 */
@ApiTags('ministry')
@Controller('ministry')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MINISTRY', 'ADMIN_GET')
@ApiBearerAuth('access-token')
export class MinistryController {
  constructor(private readonly ministryService: MinistryService) {}

  /**
   * Vue nationale agrégée (candidatures, inscriptions, écoles, offres, taux
   * d'acceptation, alertes), filtrable par période.
   * Lève BadRequestException si la date de début est postérieure à la date de fin.
   */
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

  /**
   * Statistiques de candidatures agrégées par établissement/filière/région/
   * période, filtrables et limitables via la query.
   * Lève BadRequestException si la date de début est postérieure à la date de fin.
   */
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

  /** Statistiques agrégées des établissements (répartition public/privé, par région, moyennes). */
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

  /** Répartition géographique agrégée des étudiants par région et par ville, sans identité. */
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

  /**
   * Liste paginée des contrôles de conformité par établissement. Par défaut
   * (`latestOnly` non explicitement `false`), ne retourne que le dernier
   * contrôle de chaque école plutôt que tout l'historique.
   */
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

  /**
   * Enregistre un nouveau contrôle de conformité pour un établissement
   * (crée une entrée d'historique, ne modifie pas les contrôles précédents).
   * Lève NotFoundException si l'établissement n'existe pas.
   */
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

  /** Liste paginée des rapports agrégés déjà générés, filtrable par type. */
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

  /**
   * Génère un nouveau rapport agrégé sur la période demandée : calcule un
   * instantané (dashboard, statistiques, conformité...) et le persiste.
   * Lève BadRequestException si la date de début est postérieure à la date de fin.
   */
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

  /**
   * Retourne le détail d'un rapport agrégé, y compris son instantané de
   * données.
   * Lève NotFoundException si le rapport n'existe pas.
   */
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

  /**
   * Télécharge un rapport agrégé dans le format demandé (PDF par défaut,
   * EXCEL, CSV ou JSON) sous forme de fichier joint.
   * Lève NotFoundException si le rapport n'existe pas.
   */
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

  /**
   * Endpoint public (aucune authentification requise, `@Public()`) exposant
   * un sous-ensemble volontairement restreint des statistiques nationales
   * (totaux et taux d'acceptation), sans aucune donnée sensible.
   */
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

  /**
   * Convertit une query `from`/`to` (chaînes ISO ou YYYY-MM-DD) en bornes de
   * dates exploitables par le service.
   * Lève BadRequestException si `from` est postérieure à `to`.
   */
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

  /**
   * Convertit une valeur de date en `Date`, en positionnant l'heure à
   * minuit ou 23:59:59.999 UTC lorsque la valeur est un simple jour
   * (YYYY-MM-DD), afin d'inclure toute la journée pour la borne haute.
   * Lève BadRequestException si la valeur n'est pas une date valide.
   */
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
