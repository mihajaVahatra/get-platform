import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ApplicationService } from './application.service';
import {
  SubmitApplicationDto,
  BulkApplicationResponseDto,
} from './dto/submit-application.dto';
import {
  UpdateApplicationStatusDto,
  ScheduleInterviewDto,
  ScheduleTestDto,
  ApplicationStatus,
} from './dto/update-application-status.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

/**
 * Expose les endpoints de gestion des candidatures (soumission par les
 * étudiants, consultation/traitement par les écoles, supervision par le
 * ministère et les administrateurs). Toutes les routes exigent un JWT valide ;
 * l'accès fin par rôle est ensuite contrôlé via `@Roles`/`RolesGuard`.
 */
@ApiTags('applications')
@Controller('applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly prisma: PrismaService, // ← AJOUTER
  ) {}

  // ========== STUDENT ==========

  /**
   * Soumet une ou plusieurs candidatures pour l'étudiant authentifié, une par
   * offre indiquée dans `dto.offerIds`.
   * Rôle requis : STUDENT.
   * Retourne le détail des offres traitées avec succès, échouées (offre
   * fermée/inexistante/deadline dépassée) et déjà candidatées.
   * Lève NotFoundException si le profil étudiant lié à l'utilisateur est introuvable.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit applications to multiple offers' })
  @ApiBody({ type: SubmitApplicationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Applications submitted',
    type: BulkApplicationResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid data' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async submitApplications(
    @GetUser('id') userId: string,
    @Body() dto: SubmitApplicationDto,
  ) {
    // Get student ID from user
    const student = await this.getStudentIdFromUser(userId);
    const result = await this.applicationService.submitApplications(
      student.id,
      dto.offerIds,
    );
    return {
      success: true,
      data: result,
      message: 'Applications submitted successfully',
    };
  }

  /**
   * Liste paginée des candidatures de l'étudiant authentifié, filtrable par
   * statut.
   * Rôle requis : STUDENT.
   * Lève NotFoundException si le profil étudiant est introuvable.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Get my applications' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiPaginatedResponse(ApplicationResponseDto)
  @ApiResponse({ status: HttpStatus.OK, description: 'Applications retrieved' })
  async getMyApplications(
    @GetUser('id') userId: string,
    @Query('status') status?: ApplicationStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const student = await this.getStudentIdFromUser(userId);
    const result = await this.applicationService.getStudentApplications(
      student.id,
      {
        status,
        page,
        limit,
      },
    );
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Applications retrieved successfully',
    };
  }

  // ========== SCHOOL ADMIN ==========

  /**
   * Liste paginée des candidatures reçues par l'établissement de
   * l'administrateur authentifié, filtrable par statut et par offre.
   * Rôle requis : SCHOOL_ADMIN.
   * Lève ForbiddenException si l'utilisateur n'est pas rattaché à un établissement.
   */
  @Get('school/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get applications for my school' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  @ApiQuery({ name: 'offerId', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiPaginatedResponse(ApplicationResponseDto)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'School applications retrieved',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getSchoolApplications(
    @GetUser('id') userId: string,
    @Query('status') status?: ApplicationStatus,
    @Query('offerId') offerId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.applicationService.getSchoolApplications(userId, {
      status,
      offerId,
      page,
      limit,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'School applications retrieved successfully',
    };
  }

  // ========== DETAIL (Authorized) ==========

  /**
   * Retourne les documents liés au dossier étudiant de la candidature.
   * Rôles autorisés : STUDENT (son propre dossier), SCHOOL_ADMIN (son école),
   * ADMIN_GET.
   * Lève NotFoundException si la candidature n'existe pas, ForbiddenException
   * si l'appelant n'a pas le droit de la consulter.
   */
  @Get(':id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Get documents for an authorized application' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application documents retrieved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getApplicationDocuments(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
  ) {
    const documents = await this.applicationService.getApplicationDocuments(
      id,
      userId,
      role,
    );
    return {
      success: true,
      data: documents,
      message: 'Application documents retrieved successfully',
    };
  }

  // ========== STATISTICS (Ministry/Admin only) ==========

  /**
   * Statistiques globales des candidatures (total + répartition par statut),
   * filtrables par période et par établissement.
   * Rôles autorisés : MINISTRY, ADMIN_GET.
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MINISTRY', 'ADMIN_GET')
  @ApiOperation({ summary: 'Get application statistics (Ministry only)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved' })
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const stats = await this.applicationService.getStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      schoolId,
    });
    return {
      success: true,
      data: stats,
      message: 'Statistics retrieved successfully',
    };
  }

  /**
   * Liste paginée de toutes les candidatures de la plateforme, tous
   * établissements confondus, avec recherche texte sur le nom/e-mail de
   * l'étudiant.
   * Rôle requis : ADMIN_GET.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiOperation({
    summary: 'List all applications across the platform (Admin only)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getAllApplications(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: ApplicationStatus,
    @Query('schoolId') schoolId?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.applicationService.getAllApplications({
      page,
      limit,
      status,
      schoolId,
      search,
    });
    return { success: true, data: result.items, meta: result.meta };
  }

  /**
   * Retourne le détail complet d'une candidature (offre, école, timeline).
   * Rôles autorisés : STUDENT (son propre dossier), SCHOOL_ADMIN (son école),
   * ADMIN_GET.
   * Lève NotFoundException si la candidature n'existe pas, ForbiddenException
   * si l'appelant n'a pas le droit de la consulter.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Get application details' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Application details' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getApplication(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
  ) {
    const application = await this.applicationService.getApplicationById(
      id,
      userId,
      role,
    );
    return {
      success: true,
      data: application,
      message: 'Application retrieved successfully',
    };
  }

  // ========== STATUS UPDATE (School Admin) ==========

  /**
   * Fait transitionner le statut d'une candidature (voir la machine à états
   * `APPLICATION_STATUS_TRANSITIONS`). Peut déclencher une inscription
   * automatique de l'étudiant si le nouveau statut est ACCEPTED/ENROLLED, ou
   * la promotion automatique du candidat suivant sur liste d'attente si une
   * place se libère.
   * Rôles autorisés : SCHOOL_ADMIN (son école), ADMIN_GET.
   * Lève NotFoundException si la candidature n'existe pas, ForbiddenException
   * si l'appelant ne gère pas cette école, BadRequestException si la
   * transition demandée est invalide ou si la capacité de l'offre est atteinte.
   */
  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Update application status' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiBody({ type: UpdateApplicationStatusDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Status updated' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @GetUser('id') userId: string,
  ) {
    const application = await this.applicationService.updateStatus(
      id,
      dto,
      userId,
    );
    return {
      success: true,
      data: application,
      message: 'Status updated successfully',
    };
  }

  // ========== SCHEDULE TEST / INTERVIEW ==========

  /**
   * Planifie un test/examen pour la candidature (fait passer le statut à
   * TEST_SCHEDULED) et notifie l'étudiant.
   * Rôles autorisés : SCHOOL_ADMIN (son école), ADMIN_GET.
   * Lève NotFoundException si la candidature n'existe pas, ForbiddenException
   * si l'appelant ne gère pas cette école.
   */
  @Post(':id/schedule-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Schedule a test for a candidate' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiBody({ type: ScheduleTestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Test scheduled' })
  async scheduleTest(
    @Param('id') id: string,
    @Body() dto: ScheduleTestDto,
    @GetUser('id') userId: string,
  ) {
    const application = await this.applicationService.scheduleTest(
      id,
      dto,
      userId,
    );
    return {
      success: true,
      data: application,
      message: 'Test scheduled successfully',
    };
  }

  /**
   * Planifie un entretien pour la candidature (fait passer le statut à
   * INTERVIEW_SCHEDULED) et notifie l'étudiant.
   * Rôles autorisés : SCHOOL_ADMIN (son école), ADMIN_GET.
   * Lève NotFoundException si la candidature n'existe pas, ForbiddenException
   * si l'appelant ne gère pas cette école.
   */
  @Post(':id/schedule-interview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Schedule an interview for a candidate' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiBody({ type: ScheduleInterviewDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Interview scheduled' })
  async scheduleInterview(
    @Param('id') id: string,
    @Body() dto: ScheduleInterviewDto,
    @GetUser('id') userId: string,
  ) {
    const application = await this.applicationService.scheduleInterview(
      id,
      dto,
      userId,
    );
    return {
      success: true,
      data: application,
      message: 'Interview scheduled successfully',
    };
  }

  /**
   * Enregistre le score obtenu par le candidat au test (fait passer le
   * statut à TEST_COMPLETED). Fusionne les commentaires avec les
   * informations de planification déjà stockées dans `testResults` au lieu
   * de les écraser.
   * Rôles autorisés : SCHOOL_ADMIN (son école), ADMIN_GET.
   * Lève NotFoundException si la candidature n'existe pas, ForbiddenException
   * si l'appelant ne gère pas cette école.
   */
  @Post(':id/score')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Record test score' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiBody({
    schema: {
      properties: {
        score: { type: 'number', example: 85.5 },
        comments: { type: 'string', example: 'Great result' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Score recorded' })
  async recordScore(
    @Param('id') id: string,
    @Body('score') score: number,
    @Body('comments') comments: string,
    @GetUser('id') userId: string,
  ) {
    const application = await this.applicationService.recordScore(
      id,
      { score, comments },
      userId,
    );
    return {
      success: true,
      data: application,
      message: 'Score recorded successfully',
    };
  }

  // ========== HELPER ==========
  /**
   * Résout le profil étudiant associé à un utilisateur authentifié.
   * Lève NotFoundException si aucun profil étudiant n'est lié à cet utilisateur.
   */
  private async getStudentIdFromUser(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }
}
