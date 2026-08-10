import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Patch,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SchoolService } from './school.service';
import { SchedulingService } from './scheduling.service';
import { ScheduleGenerationService } from './schedule-generation.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { CreateSchoolClassDto, UpdateSchoolClassDto } from './dto/school-class.dto';
import {
  AssignTeacherToRequirementDto,
  CreateSubjectRequirementDto,
  UpdateSubjectRequirementDto,
} from './dto/subject-requirement.dto';
import {
  CreateSchoolTimeSlotDto,
  UpdateSchoolTimeSlotDto,
} from './dto/school-time-slot.dto';
import {
  StorageService,
  ImageEntityType,
  ImageType,
} from '../../common/services/storage.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';
import {
  CreateSchoolCourseDto,
  UpdateSchoolCourseDto,
} from './dto/create-school-course.dto';
import { CreateCourseSlotDto, UpdateCourseSlotDto } from './dto/course-slot.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { BroadcastAnnouncementDto } from './dto/broadcast-announcement.dto';
import { CreateSchoolProgramDto, UpdateSchoolProgramDto } from './dto/school-program.dto';
import { CreateSchoolAcademicYearDto, UpdateSchoolAcademicYearDto } from './dto/school-academic-year.dto';
import {
  CreateSubjectDto,
  UpdateSubjectDto,
  CreateSchoolRequirementDto,
  UpdateSchoolRequirementDto,
  UpdateSchoolStudentEnrollmentDto,
} from './dto/school-admin-actions.dto';

type SchoolAdminSession = {
  schoolAdmin?: {
    schoolId: string;
  };
};

/**
 * Contrôleur de gestion des écoles.
 *
 * Regroupe les routes publiques de consultation des écoles ainsi que
 * l'ensemble des opérations d'administration d'une école : profil et logo,
 * programmes, années académiques, matières, prérequis d'admission,
 * inscriptions et suivi des élèves, enseignants et affectations,
 * annonces (individuelles ou diffusées), rapports/statistiques et export CSV,
 * paiements, et le moteur de planification (salles, créneaux horaires,
 * classes, besoins horaires par matière et génération automatique
 * d'emploi du temps).
 *
 * La plupart des routes d'administration d'école utilisent le préfixe
 * `me/...` et résolvent l'école ciblée à partir de l'admin d'école
 * authentifié (`user.schoolAdmin.schoolId`), plutôt que depuis un
 * paramètre d'URL — ce qui garantit qu'un administrateur ne peut agir
 * que sur sa propre école.
 */
@ApiTags('schools')
@Controller('schools')
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly schedulingService: SchedulingService,
    private readonly scheduleGenerationService: ScheduleGenerationService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  // ========== PUBLIC ROUTES ==========

  /**
   * Liste les écoles, avec pagination et filtres optionnels (ville, type
   * d'établissement, recherche textuelle).
   *
   * Route publique (`@Public()`), aucune authentification requise.
   *
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @param city Filtre optionnel par ville.
   * @param type Filtre optionnel par type d'école (`PUBLIC` ou `PRIVATE`).
   * @param search Filtre optionnel de recherche textuelle.
   * @returns La liste paginée des écoles.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get list of schools' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'city', required: false, example: 'Antananarivo' })
  @ApiQuery({ name: 'type', required: false, enum: ['PUBLIC', 'PRIVATE'] })
  @ApiQuery({ name: 'search', required: false, example: 'management' })
  @ApiPaginatedResponse(SchoolResponseDto)
  async getSchools(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('city') city?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.schoolService.findAll(page, limit, {
      city,
      type,
      search,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Schools retrieved successfully',
    };
  }

  // ========== ADMIN ROUTES ==========

  /**
   * Liste les élèves inscrits toutes écoles confondues, avec pagination,
   * recherche et filtre optionnel par école.
   *
   * Réservé au rôle `ADMIN_GET` (guards `JwtAuthGuard`, `RolesGuard`).
   *
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @param search Filtre de recherche optionnel.
   * @param schoolId Filtre optionnel par identifiant d'école.
   * @returns La liste paginée des élèves inscrits.
   */
  @Get('students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get enrolled students across all schools (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'Rakoto' })
  @ApiQuery({ name: 'schoolId', required: false })
  async getAllStudents(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const result = await this.schoolService.getAllEnrolledStudents(
      page,
      limit,
      search,
      schoolId,
    );
    return { success: true, data: result.items, meta: result.meta };
  }

  /**
   * Liste les programmes de formation toutes écoles confondues, avec
   * pagination et filtre optionnel par école.
   *
   * Réservé au rôle `ADMIN_GET` (guards `JwtAuthGuard`, `RolesGuard`).
   *
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @param schoolId Filtre optionnel par identifiant d'école.
   * @returns La liste paginée des programmes.
   */
  @Get('programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get programs across all schools (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'schoolId', required: false })
  async getAllPrograms(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('schoolId') schoolId?: string,
  ) {
    const result = await this.schoolService.getAllPrograms(page, limit, schoolId);
    return { success: true, data: result.items, meta: result.meta };
  }

  /**
   * Crée une nouvelle école.
   *
   * Réservé au rôle `ADMIN_GET` (guards `JwtAuthGuard`, `RolesGuard`).
   *
   * @param dto Données de création de l'école.
   * @param user Utilisateur authentifié, utilisé comme créateur.
   * @returns L'école créée.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new school (Admin only)' })
  @ApiBody({ type: CreateSchoolDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'School created' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - Admin required',
  })
  async createSchool(@Body() dto: CreateSchoolDto, @GetUser() user: any) {
    const school = await this.schoolService.create(dto, user.id);
    return {
      success: true,
      data: school,
      message: 'School created successfully',
    };
  }

  /**
   * Met à jour une école.
   *
   * Authentification requise (`JwtAuthGuard`) mais pas de `RolesGuard` :
   * l'autorisation est vérifiée manuellement dans le corps de la méthode
   * (admin plateforme `ADMIN_GET`, ou administrateur de cette école
   * précise). Toute autre situation lève une `ForbiddenException`.
   *
   * @param id Identifiant de l'école à modifier.
   * @param dto Champs à mettre à jour.
   * @param user Utilisateur authentifié.
   * @returns L'école mise à jour.
   * @throws ForbiddenException Si l'utilisateur n'est ni admin plateforme
   *   ni administrateur de cette école.
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a school' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiBody({ type: UpdateSchoolDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'School updated' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async updateSchool(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolDto,
    @GetUser() user: any,
  ) {
    const isAdminGet = user.role === 'ADMIN_GET';
    const isSchoolAdmin = user.schoolAdmin && user.schoolAdmin.schoolId === id;

    if (!isAdminGet && !isSchoolAdmin) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier cette école",
      );
    }

    const school = await this.schoolService.update(id, dto, user.id);
    return {
      success: true,
      data: school,
      message: 'School updated successfully',
    };
  }

  /**
   * Supprime une école.
   *
   * Réservé au rôle `ADMIN_GET` (guards `JwtAuthGuard`, `RolesGuard`).
   *
   * @param id Identifiant de l'école à supprimer.
   * @param user Utilisateur authentifié effectuant la suppression.
   * @throws NotFoundException Si l'école n'existe pas (levée par le service).
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a school (Admin only)' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'School deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  async deleteSchool(@Param('id') id: string, @GetUser() user: any) {
    await this.schoolService.delete(id, user.id);
    return {
      success: true,
      message: 'School deleted successfully',
    };
  }

  // ========== LOGO UPLOAD ==========

  /**
   * Téléverse (ou remplace) le logo d'une école.
   *
   * Authentification requise (`JwtAuthGuard`) ; autorisation vérifiée
   * manuellement (admin plateforme `ADMIN_GET` ou administrateur de cette
   * école). Le fichier est limité à 5 Mo et doit être une image
   * (jpeg/png/webp), sinon rejeté par le filtre de l'intercepteur ou par
   * une `BadRequestException` explicite si aucun fichier n'est fourni.
   *
   * @param schoolId Identifiant de l'école cible.
   * @param user Utilisateur authentifié.
   * @param file Fichier image envoyé en `multipart/form-data`.
   * @returns L'URL du logo téléversé.
   * @throws ForbiddenException Si l'utilisateur n'est pas autorisé.
   * @throws BadRequestException Si aucun fichier n'est fourni ou si le
   *   format n'est pas une image supportée.
   * @throws NotFoundException Si l'école n'existe pas (via `findOne`).
   */
  @Post(':id/logo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upload school logo' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Logo uploaded' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Seules les images sont autorisées'),
            false,
          );
        }
      },
    }),
  )
  async uploadLogo(
    @Param('id') schoolId: string,
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Vérifier les droits
    const isAdminGet = user.role === 'ADMIN_GET';
    const isSchoolAdmin =
      user.schoolAdmin && user.schoolAdmin.schoolId === schoolId;

    if (!isAdminGet && !isSchoolAdmin) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier cette école",
      );
    }

    await this.schoolService.findOne(schoolId);

    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }

    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.SCHOOL,
      entityId: schoolId,
      type: ImageType.LOGO,
    });

    await this.schoolService.updateLogo(schoolId, result.url);

    return {
      success: true,
      data: { logoUrl: result.url },
      message: 'Logo uploaded successfully',
    };
  }

  // ========== SCHOOL ADMIN ROUTES ==========

  /**
   * Récupère les informations de l'école de l'administrateur connecté.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié (doit avoir un profil `schoolAdmin`).
   * @returns Les détails de l'école.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current school info (School Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'School info retrieved' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - School Admin required',
  })
  async getMySchool(@GetUser() user: any) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const school = await this.schoolService.findOne(user.schoolAdmin.schoolId);
    return {
      success: true,
      data: school,
      message: 'School info retrieved successfully',
    };
  }

  /**
   * Liste les classes utilisées par les élèves inscrits de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié (doit avoir un profil `schoolAdmin`).
   * @returns La liste des classes.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/students/classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get enrolled student classes for my school' })
  async getMyStudentClasses(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const classes = await this.schoolService.getStudentClasses(
      user.schoolAdmin.schoolId,
    );
    return { success: true, data: classes };
  }

  /**
   * Liste les matières de mon école. Réservé au rôle `SCHOOL_ADMIN`.
   * @param user Utilisateur authentifié.
   * @returns La liste des matières.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/subjects') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async getMySubjects(@GetUser() user: SchoolAdminSession) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.getSubjects(user.schoolAdmin.schoolId) }; }
  /**
   * Liste les affectations d'enseignants inactives de mon école.
   * Réservé au rôle `SCHOOL_ADMIN`.
   * @param user Utilisateur authentifié.
   * @returns La liste des affectations inactives.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/teachers/inactive') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async getMyInactiveTeachers(@GetUser() user: SchoolAdminSession) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.getInactiveTeacherAssignments(user.schoolAdmin.schoolId) }; }
  /**
   * Recherche un enseignant par adresse email (pour affectation ultérieure).
   * Réservé au rôle `SCHOOL_ADMIN`.
   * @param user Utilisateur authentifié.
   * @param email Adresse email de l'enseignant recherché.
   * @returns L'enseignant trouvé, le cas échéant.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/teachers/search') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async searchMyTeacher(@GetUser() user: SchoolAdminSession, @Query('email') email: string) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.findTeacherByEmail(email) }; }
  /**
   * Crée une nouvelle matière pour mon école. Réservé au rôle `SCHOOL_ADMIN`.
   * @param user Utilisateur authentifié.
   * @param body Nom de la matière à créer.
   * @returns La matière créée.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/subjects') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async createMySubject(@GetUser() user: SchoolAdminSession, @Body() body: CreateSubjectDto) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.createSubject(user.schoolAdmin.schoolId, body.name) }; }
  /**
   * Active/désactive une matière de mon école. Réservé au rôle `SCHOOL_ADMIN`.
   * @param user Utilisateur authentifié.
   * @param id Identifiant de la matière.
   * @param body Nouvel état `isActive`.
   * @returns La matière mise à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Patch('me/subjects/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async updateMySubject(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() body: UpdateSubjectDto) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.updateSubject(user.schoolAdmin.schoolId, id, body.isActive) }; }

  /**
   * Liste les programmes de formation de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns La liste des programmes.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get school programs for my school' })
  async getMyPrograms(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.getPrograms(user.schoolAdmin.schoolId) };
  }

  /**
   * Crée un programme de formation pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param dto Données du programme à créer.
   * @returns Le programme créé.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a school program for my school' })
  async createMyProgram(@GetUser() user: SchoolAdminSession, @Body() dto: CreateSchoolProgramDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.createProgram(user.schoolAdmin.schoolId, dto) };
  }

  /**
   * Met à jour un programme de formation de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param id Identifiant du programme.
   * @param dto Champs à mettre à jour.
   * @returns Le programme mis à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Patch('me/programs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a school program for my school' })
  async updateMyProgram(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateSchoolProgramDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.updateProgram(user.schoolAdmin.schoolId, id, dto) };
  }

  /**
   * Liste les années académiques de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns La liste des années académiques.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/academic-years')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get academic years for my school' })
  async getMyAcademicYears(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.getAcademicYears(user.schoolAdmin.schoolId) };
  }

  /**
   * Crée une année académique pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param dto Données de l'année académique à créer.
   * @returns L'année académique créée.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/academic-years')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an academic year for my school' })
  async createMyAcademicYear(@GetUser() user: SchoolAdminSession, @Body() dto: CreateSchoolAcademicYearDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.createAcademicYear(user.schoolAdmin.schoolId, dto) };
  }

  /**
   * Met à jour une année académique de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param id Identifiant de l'année académique.
   * @param dto Champs à mettre à jour.
   * @returns L'année académique mise à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Patch('me/academic-years/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an academic year for my school' })
  async updateMyAcademicYear(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateSchoolAcademicYearDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.updateAcademicYear(user.schoolAdmin.schoolId, id, dto) };
  }

  /**
   * Liste les documents des élèves inscrits dans mon école, avec pagination
   * et filtres (année d'inscription, type de document, recherche).
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @param enrolledYear Filtre optionnel par année d'inscription.
   * @param type Filtre optionnel par type de document.
   * @param search Filtre de recherche optionnel.
   * @returns La liste paginée des documents.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get documents for enrolled students in my school' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'enrolledYear', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['CV', 'LETTER', 'ID', 'DIPLOMA', 'PHOTO', 'OTHER'] })
  @ApiQuery({ name: 'search', required: false })
  async getMyStudentDocuments(
    @GetUser() user: SchoolAdminSession,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('enrolledYear') enrolledYear?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const result = await this.schoolService.getStudentDocuments(
      user.schoolAdmin.schoolId,
      page,
      limit,
      enrolledYear,
      type,
      search,
    );
    return { success: true, data: result.items, meta: result.meta };
  }

  /**
   * Liste les élèves inscrits dans mon école, avec recherche et pagination.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param search Filtre de recherche optionnel.
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @returns La liste paginée des élèves inscrits.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get enrolled students for my school' })
  @ApiQuery({ name: 'search', required: false, example: 'Rakoto' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrolled students retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - School Admin required',
  })
  async getMySchoolStudents(
    @GetUser() user: SchoolAdminSession,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }

    const result = await this.schoolService.getEnrolledStudents(
      user.schoolAdmin.schoolId,
      page,
      limit,
      search,
    );
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Enrolled students retrieved successfully',
    };
  }

  /**
   * Récupère le détail d'un élève inscrit dans mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param studentId Identifiant de l'élève.
   * @returns Le détail de l'élève.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   * @throws NotFoundException Si l'élève n'existe pas ou n'est pas inscrit
   *   dans cette école (levée par le service).
   */
  @Get('me/students/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get enrolled student detail for my school' })
  async getMySchoolStudentDetail(
    @GetUser() user: SchoolAdminSession,
    @Param('studentId') studentId: string,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    return {
      success: true,
      data: await this.schoolService.getStudentDetail(
        user.schoolAdmin.schoolId,
        studentId,
      ),
    };
  }

  /**
   * Inscrit un élève existant (déjà présent dans le système) dans mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param dto Données d'inscription (élève, programme, classe, etc.).
   * @returns L'inscription créée.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/students/enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enroll an existing student in my school' })
  async enrollMySchoolStudent(
    @GetUser() user: SchoolAdminSession,
    @Body() dto: EnrollStudentDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const student = await this.schoolService.enrollStudent(
      user.schoolAdmin.schoolId,
      dto,
    );
    return {
      success: true,
      data: student,
      message: 'Student enrolled successfully',
    };
  }

  /**
   * Met à jour l'inscription d'un élève dans mon école (programme, classe,
   * année académique, statut, etc.).
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param studentId Identifiant de l'élève.
   * @param body Champs d'inscription à mettre à jour.
   * @returns L'inscription mise à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Patch('me/students/:studentId') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async updateMySchoolStudentEnrollment(@GetUser() user: SchoolAdminSession, @Param('studentId') studentId: string, @Body() body: UpdateSchoolStudentEnrollmentDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.updateEnrollment(user.schoolAdmin.schoolId, studentId, body) };
  }

  /**
   * Inscrit plusieurs élèves en une seule opération (import en masse), à
   * partir d'une liste de lignes (email, programme, niveau, année).
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param rows Lignes d'inscription à traiter ; si `rows` n'est pas un
   *   tableau, une liste vide est utilisée à la place (pas d'erreur levée).
   * @returns Le résultat de l'inscription en masse (créées/échecs selon le service).
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/students/enroll/bulk') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async bulkEnrollMySchoolStudents(@GetUser() user: SchoolAdminSession, @Body('rows') rows: Array<{ email: string; programName: string; level: number; academicYearLabel: string }>) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.bulkEnrollStudents(user.schoolAdmin.schoolId, Array.isArray(rows) ? rows : []) };
  }

  /**
   * Envoie une annonce aux élèves inscrits de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié (identifiant utilisé comme expéditeur).
   * @param dto Contenu de l'annonce à envoyer.
   * @returns Le résultat de l'envoi de l'annonce.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send an announcement to my enrolled students' })
  async sendMySchoolAnnouncement(
    @GetUser() user: SchoolAdminSession & { id: string },
    @Body() dto: CreateAnnouncementDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const result = await this.schoolService.createAnnouncement(
      user.schoolAdmin.schoolId,
      user.id,
      dto,
    );
    return {
      success: true,
      data: result,
      message: 'Announcement sent successfully',
    };
  }

  /**
   * Liste l'historique des annonces envoyées par mon école, avec pagination.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @returns La liste paginée des annonces.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get announcement history for my school' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getMySchoolAnnouncements(
    @GetUser() user: SchoolAdminSession,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const result = await this.schoolService.getAnnouncements(
      user.schoolAdmin.schoolId,
      page,
      limit,
    );
    return { success: true, data: result.items, meta: result.meta };
  }

  /**
   * Attache une photo/illustration à une annonce existante de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`. Le fichier est limité à 5 Mo et doit
   * être une image (jpeg/png/webp), sinon rejeté par le filtre de
   * l'intercepteur ou par une `BadRequestException` explicite si aucun
   * fichier n'est fourni.
   *
   * @param id Identifiant de l'annonce.
   * @param user Utilisateur authentifié.
   * @param file Fichier image envoyé en `multipart/form-data`.
   * @returns L'URL de l'image attachée.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   * @throws BadRequestException Si aucun fichier n'est fourni ou si le
   *   format n'est pas une image supportée.
   */
  @Post('me/announcements/:id/photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Attach a photo to one of my school's announcements" })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Seules les images sont autorisées'),
            false,
          );
        }
      },
    }),
  )
  async uploadAnnouncementPhoto(
    @Param('id') id: string,
    @GetUser() user: SchoolAdminSession,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException("Réservé aux administrateurs d'école");
    }
    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }
    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.ANNOUNCEMENT,
      entityId: id,
      type: ImageType.ILLUSTRATION,
    });
    await this.schoolService.setAnnouncementPhoto(
      user.schoolAdmin.schoolId,
      id,
      result.url,
    );
    return {
      success: true,
      data: { imageUrl: result.url },
      message: 'Photo attachée avec succès',
    };
  }

  /**
   * Liste les annonces reçues par l'utilisateur connecté, avec pagination.
   *
   * Réservé aux rôles `STUDENT` et `TEACHER`.
   *
   * @param userId Identifiant de l'utilisateur connecté (destinataire).
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 20).
   * @returns La liste paginée des annonces reçues.
   */
  @Get('announcements/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'TEACHER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get announcements addressed to me' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getMyReceivedAnnouncements(
    @GetUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.schoolService.getMyAnnouncements(
      userId,
      page,
      limit,
    );
    return { success: true, data: result.items, meta: result.meta };
  }

  /**
   * Diffuse une annonce aux élèves de toutes les écoles actives.
   *
   * Réservé au rôle `ADMIN_GET`.
   *
   * @param user Utilisateur authentifié (identifiant utilisé comme expéditeur).
   * @param dto Contenu de l'annonce à diffuser.
   * @returns Le résultat de la diffusion.
   */
  @Post('announcements/broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Broadcast an announcement to students of every active school (Admin only)',
  })
  async broadcastAnnouncement(
    @GetUser() user: { id: string },
    @Body() dto: BroadcastAnnouncementDto,
  ) {
    const result = await this.schoolService.broadcastAnnouncement(user.id, dto);
    return {
      success: true,
      data: result,
      message: 'Announcement broadcast successfully',
    };
  }

  /**
   * Liste l'historique des annonces diffusées par l'admin plateforme connecté.
   *
   * Réservé au rôle `ADMIN_GET`.
   *
   * @param user Utilisateur authentifié.
   * @returns La liste des diffusions passées.
   */
  @Get('announcements/broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my broadcast announcement history (Admin only)',
  })
  async getBroadcastHistory(@GetUser() user: { id: string }) {
    const items = await this.schoolService.getBroadcastHistory(user.id);
    return { success: true, data: items };
  }

  /**
   * Récupère les agrégats du pipeline de candidatures (par statut) pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns Les agrégats du pipeline de candidatures.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/reports/pipeline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get application pipeline aggregates for my school' })
  async getMySchoolReportPipeline(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException("Cette fonctionnalité est réservée aux administrateurs d'école");
    }
    return { success: true, data: await this.schoolService.getReportPipeline(user.schoolAdmin.schoolId) };
  }

  /**
   * Récupère les agrégats des résultats de candidatures (acceptées/rejetées, etc.)
   * pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns Les agrégats des résultats de candidatures.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/reports/outcomes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get application outcome aggregates for my school' })
  async getMySchoolReportOutcomes(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException("Cette fonctionnalité est réservée aux administrateurs d'école");
    }
    return { success: true, data: await this.schoolService.getReportOutcomes(user.schoolAdmin.schoolId) };
  }

  /**
   * Récupère la tendance mensuelle des candidatures pour mon école, sur
   * les N derniers mois.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param months Nombre de mois à couvrir (défaut 6).
   * @returns La série de tendance mensuelle.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/reports/trend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get monthly application trend for my school' })
  @ApiQuery({ name: 'months', required: false, example: 6 })
  async getMySchoolReportTrend(
    @GetUser() user: SchoolAdminSession,
    @Query('months') months = 6,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException("Cette fonctionnalité est réservée aux administrateurs d'école");
    }
    return { success: true, data: await this.schoolService.getReportTrend(user.schoolAdmin.schoolId, months) };
  }

  /**
   * Récupère le nombre d'élèves inscrits par classe pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns Les effectifs par classe.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/reports/by-class')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get enrolled student counts by class for my school' })
  async getMySchoolReportByClass(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException("Cette fonctionnalité est réservée aux administrateurs d'école");
    }
    return { success: true, data: await this.schoolService.getReportByClass(user.schoolAdmin.schoolId) };
  }

  /**
   * Récupère le classement des offres par nombre de candidatures reçues,
   * pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns Le classement des offres.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/reports/by-offer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get top application counts by offer for my school' })
  async getMySchoolReportByOffer(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException("Cette fonctionnalité est réservée aux administrateurs d'école");
    }
    return { success: true, data: await this.schoolService.getReportByOffer(user.schoolAdmin.schoolId) };
  }

  /**
   * Exporte au format CSV les candidatures ou les élèves inscrits de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`. Le paramètre `type` est obligatoire et
   * validé explicitement (`applications` ou `students`) avant l'export.
   *
   * @param user Utilisateur authentifié.
   * @param type Type de rapport à exporter (`applications` ou `students`).
   * @returns Un fichier CSV téléchargeable (`StreamableFile`).
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   * @throws BadRequestException Si `type` n'est ni `applications` ni `students`.
   */
  @Get('me/reports/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Export school applications or enrolled students as CSV' })
  @ApiQuery({ name: 'type', enum: ['applications', 'students'], required: true })
  async exportMySchoolReport(
    @GetUser() user: SchoolAdminSession,
    @Query('type') type?: string,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    if (type !== 'applications' && type !== 'students') {
      throw new BadRequestException('Type de rapport invalide');
    }
    const buffer = await this.schoolService.exportCsv(
      user.schoolAdmin.schoolId,
      type,
    );
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  /**
   * Liste les affectations d'enseignants actives de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns La liste des affectations d'enseignants actives.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/teachers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get active teacher assignments for my school' })
  async getMySchoolTeachers(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }

    const teachers = await this.schoolService.getTeacherAssignments(
      user.schoolAdmin.schoolId,
    );
    return {
      success: true,
      data: teachers,
      message: 'Teacher assignments retrieved successfully',
    };
  }

  /**
   * Affecte un enseignant existant à mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param dto Données de l'affectation (enseignant, matière, etc.).
   * @returns L'affectation créée.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/teachers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign an existing teacher to my school' })
  async assignMySchoolTeacher(
    @GetUser() user: SchoolAdminSession,
    @Body() dto: AssignTeacherDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }

    const assignment = await this.schoolService.assignTeacher(
      user.schoolAdmin.schoolId,
      dto,
    );
    return {
      success: true,
      data: assignment,
      message: 'Teacher assigned successfully',
    };
  }

  /**
   * Met à jour une affectation d'enseignant de mon école (statut, matières, etc.).
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param teacherSchoolId Identifiant de l'affectation enseignant-école.
   * @param dto Champs à mettre à jour.
   * @returns L'affectation mise à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Patch('me/teachers/:teacherSchoolId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a teacher assignment for my school' })
  async updateMySchoolTeacher(
    @GetUser() user: SchoolAdminSession,
    @Param('teacherSchoolId') teacherSchoolId: string,
    @Body() dto: UpdateTeacherAssignmentDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }

    const assignment = await this.schoolService.updateTeacherAssignment(
      user.schoolAdmin.schoolId,
      teacherSchoolId,
      dto,
    );
    return {
      success: true,
      data: assignment,
      message: 'Teacher assignment updated successfully',
    };
  }

  /**
   * Liste les cours de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns La liste des cours.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get courses for my school' })
  async getMySchoolCourses(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const courses = await this.schoolService.getCourses(user.schoolAdmin.schoolId);
    return { success: true, data: courses, message: 'Courses retrieved successfully' };
  }

  /**
   * Crée un cours pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param dto Données du cours à créer.
   * @returns Le cours créé.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a course for my school' })
  async createMySchoolCourse(
    @GetUser() user: SchoolAdminSession,
    @Body() dto: CreateSchoolCourseDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const course = await this.schoolService.createCourse(
      user.schoolAdmin.schoolId,
      dto,
    );
    return { success: true, data: course, message: 'Course created successfully' };
  }

  /**
   * Met à jour un cours de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param id Identifiant du cours.
   * @param dto Champs à mettre à jour.
   * @returns Le cours mis à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Put('me/courses/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a course for my school' })
  async updateMySchoolCourse(
    @GetUser() user: SchoolAdminSession,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolCourseDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const course = await this.schoolService.updateCourse(
      user.schoolAdmin.schoolId,
      id,
      dto,
    );
    return { success: true, data: course, message: 'Course updated successfully' };
  }

  /**
   * Liste les créneaux d'emploi du temps structurés de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @returns La liste des créneaux d'emploi du temps.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get structured schedule slots for my school' })
  async getMySchoolSchedule(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const slots = await this.schoolService.getSchedule(user.schoolAdmin.schoolId);
    return { success: true, data: slots, message: 'Schedule retrieved successfully' };
  }

  /**
   * Génère automatiquement l'emploi du temps de mon école (ou d'une seule
   * classe si précisé dans le DTO), en s'appuyant sur les salles, créneaux
   * horaires, classes et besoins horaires par matière déjà configurés.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param dto Paramètres de génération (portée, contraintes, etc.).
   * @returns Le résultat de la génération de l'emploi du temps.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/schedule/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Auto-generate the schedule for my school (or a single class)' })
  async generateMySchoolSchedule(
    @GetUser() user: SchoolAdminSession,
    @Body() dto: GenerateScheduleDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const result = await this.scheduleGenerationService.generate(
      user.schoolAdmin.schoolId,
      dto,
    );
    return { success: true, data: result, message: 'Schedule generation completed' };
  }

  /**
   * Crée un créneau structuré (jour/heure/salle) pour un cours de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param courseId Identifiant du cours concerné.
   * @param dto Données du créneau à créer.
   * @returns Le créneau créé.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/courses/:courseId/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a structured slot for one of my courses' })
  async createMyCourseSlot(
    @GetUser() user: SchoolAdminSession,
    @Param('courseId') courseId: string,
    @Body() dto: CreateCourseSlotDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const slot = await this.schoolService.createCourseSlot(
      user.schoolAdmin.schoolId,
      courseId,
      dto,
    );
    return { success: true, data: slot, message: 'Course slot created successfully' };
  }

  /**
   * Met à jour un créneau structuré d'un cours de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param courseId Identifiant du cours concerné.
   * @param slotId Identifiant du créneau à modifier.
   * @param dto Champs à mettre à jour.
   * @returns Le créneau mis à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Patch('me/courses/:courseId/slots/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a structured slot for one of my courses' })
  async updateMyCourseSlot(
    @GetUser() user: SchoolAdminSession,
    @Param('courseId') courseId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateCourseSlotDto,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const slot = await this.schoolService.updateCourseSlot(
      user.schoolAdmin.schoolId,
      courseId,
      slotId,
      dto,
    );
    return { success: true, data: slot, message: 'Course slot updated successfully' };
  }

  /**
   * Supprime un créneau structuré d'un cours de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param courseId Identifiant du cours concerné.
   * @param slotId Identifiant du créneau à supprimer.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Delete('me/courses/:courseId/slots/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a structured slot for one of my courses' })
  async deleteMyCourseSlot(
    @GetUser() user: SchoolAdminSession,
    @Param('courseId') courseId: string,
    @Param('slotId') slotId: string,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    await this.schoolService.deleteCourseSlot(
      user.schoolAdmin.schoolId,
      courseId,
      slotId,
    );
    return { success: true, message: 'Course slot deleted successfully' };
  }

  /**
   * Récupère le résumé des paiements et le détail des transactions de mon
   * école, avec pagination et filtre optionnel par statut.
   *
   * Réservé au rôle `SCHOOL_ADMIN`.
   *
   * @param user Utilisateur authentifié.
   * @param page Numéro de page (défaut 1).
   * @param limit Taille de page (défaut 5).
   * @param status Filtre optionnel par statut de paiement.
   * @returns Le résumé des paiements et la liste paginée des transactions.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get payment summary and transaction details for my school',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  async getMySchoolPayments(
    @GetUser() user: SchoolAdminSession,
    @Query('page') page = 1,
    @Query('limit') limit = 5,
    @Query('status') status?: string,
  ) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const result = await this.schoolService.getPayments(
      user.schoolAdmin.schoolId,
      page,
      limit,
      status,
    );
    return {
      success: true,
      data: { summary: result.summary, payments: result.items },
      meta: result.meta,
      message: 'School payments retrieved successfully',
    };
  }

  /**
   * Liste les prérequis d'admission actifs de mon école, avec filtre
   * optionnel par diplôme (inclut aussi les prérequis génériques sans
   * diplôme associé lorsque `diploma` est fourni).
   *
   * Réservé au rôle `SCHOOL_ADMIN`. Accède directement à Prisma plutôt que
   * de passer par `schoolService`, contrairement à la plupart des autres
   * routes de ce contrôleur.
   *
   * @param userId Identifiant de l'utilisateur connecté.
   * @param diploma Filtre optionnel par type de diplôme.
   * @returns La liste des prérequis actifs, triée par nom.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Get('me/requirements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  async getMyRequirements(@GetUser('id') userId: string, @Query('diploma') diploma?: string) {
    const admin = await this.prisma.schoolAdmin.findUnique({ where: { userId } });
    if (!admin) throw new ForbiddenException('Profil administrateur introuvable');
    return this.prisma.schoolRequirement.findMany({ where: { schoolId: admin.schoolId, isActive: true, ...(diploma ? { OR: [{ diploma }, { diploma: null }] } : {}) }, orderBy: { name: 'asc' } });
  }

  /**
   * Crée un prérequis d'admission pour mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`. Accède directement à Prisma. Le type
   * du prérequis vaut `DOCUMENT` par défaut, et `isRequired` vaut `true`
   * par défaut si non précisé.
   *
   * @param userId Identifiant de l'utilisateur connecté.
   * @param body Données du prérequis à créer.
   * @returns Le prérequis créé.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin d'école.
   */
  @Post('me/requirements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  async createMyRequirement(@GetUser('id') userId: string, @Body() body: CreateSchoolRequirementDto) {
    const admin = await this.prisma.schoolAdmin.findUnique({ where: { userId } });
    if (!admin) throw new ForbiddenException('Profil administrateur introuvable');
    return this.prisma.schoolRequirement.create({ data: { schoolId: admin.schoolId, name: body.name, description: body.description, type: body.type || 'DOCUMENT', diploma: body.diploma, isRequired: body.isRequired ?? true } });
  }

  /**
   * Met à jour un prérequis d'admission de mon école.
   *
   * Réservé au rôle `SCHOOL_ADMIN`. Accède directement à Prisma. Vérifie
   * explicitement que le prérequis appartient bien à l'école de
   * l'administrateur avant modification.
   *
   * @param userId Identifiant de l'utilisateur connecté.
   * @param id Identifiant du prérequis à modifier.
   * @param body Champs à mettre à jour.
   * @returns Le prérequis mis à jour.
   * @throws ForbiddenException Si l'utilisateur n'a pas de profil admin
   *   d'école, ou si le prérequis n'appartient pas à son école (message
   *   "Prérequis introuvable").
   */
  @Patch('me/requirements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  async updateMyRequirement(@GetUser('id') userId: string, @Param('id') id: string, @Body() body: UpdateSchoolRequirementDto) {
    const admin = await this.prisma.schoolAdmin.findUnique({ where: { userId } });
    if (!admin) throw new ForbiddenException('Profil administrateur introuvable');
    const item = await this.prisma.schoolRequirement.findFirst({ where: { id, schoolId: admin.schoolId } });
    if (!item) throw new ForbiddenException('Prérequis introuvable');
    return this.prisma.schoolRequirement.update({ where: { id }, data: body });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get school details' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'School details' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  async getSchool(@Param('id') id: string) {
    const school = await this.schoolService.findOne(id);
    return {
      success: true,
      data: school,
      message: 'School retrieved successfully',
    };
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current school statistics (School Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'School statistics retrieved',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - School Admin required',
  })
  async getMySchoolStats(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException(
        "Cette fonctionnalité est réservée aux administrateurs d'école",
      );
    }
    const schoolId = user.schoolAdmin.schoolId;
    const offerWhere = { schoolId, deletedAt: null };
    const applicationWhere = {
      deletedAt: null,
      offer: { schoolId },
    };
    const [
      totalOffers,
      openOffers,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications,
    ] = await Promise.all([
      this.prisma.offer.count({ where: offerWhere }),
      this.prisma.offer.count({ where: { ...offerWhere, isOpen: true } }),
      this.prisma.application.count({ where: applicationWhere }),
      this.prisma.application.count({
        where: { ...applicationWhere, status: 'PENDING' },
      }),
      this.prisma.application.count({
        where: { ...applicationWhere, status: 'ACCEPTED' },
      }),
      this.prisma.application.count({
        where: { ...applicationWhere, status: 'REJECTED' },
      }),
    ]);

    return {
      success: true,
      data: {
        schoolId,
        totalOffers,
        openOffers,
        totalApplications,
        pendingApplications,
        acceptedApplications,
        rejectedApplications,
      },
      message: 'School statistics retrieved successfully',
    };
  }

  // ════════════════════════════════════════════
  //  PLANIFICATION (moteur d'emploi du temps) — Phase 1
  // ════════════════════════════════════════════

  @Get('me/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my school rooms' })
  async listMyRooms(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.listRooms(user.schoolAdmin.schoolId) };
  }

  @Post('me/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a room in my school' })
  async createMyRoom(@GetUser() user: SchoolAdminSession, @Body() dto: CreateRoomDto) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.createRoom(user.schoolAdmin.schoolId, dto) };
  }

  @Patch('me/rooms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a room in my school' })
  async updateMyRoom(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateRoomDto) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.updateRoom(user.schoolAdmin.schoolId, id, dto) };
  }

  @Delete('me/rooms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a room in my school' })
  async deleteMyRoom(@GetUser() user: SchoolAdminSession, @Param('id') id: string) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    await this.schedulingService.deleteRoom(user.schoolAdmin.schoolId, id);
    return { success: true, message: 'Salle supprimée' };
  }

  @Get('me/time-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my school time-slot template' })
  async listMyTimeSlots(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.listTimeSlots(user.schoolAdmin.schoolId) };
  }

  @Post('me/time-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a time slot in my school template' })
  async createMyTimeSlot(@GetUser() user: SchoolAdminSession, @Body() dto: CreateSchoolTimeSlotDto) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.createTimeSlot(user.schoolAdmin.schoolId, dto) };
  }

  @Patch('me/time-slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a time slot in my school template' })
  async updateMyTimeSlot(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateSchoolTimeSlotDto) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.updateTimeSlot(user.schoolAdmin.schoolId, id, dto) };
  }

  @Delete('me/time-slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a time slot in my school template' })
  async deleteMyTimeSlot(@GetUser() user: SchoolAdminSession, @Param('id') id: string) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    await this.schedulingService.deleteTimeSlot(user.schoolAdmin.schoolId, id);
    return { success: true, message: 'Créneau supprimé' };
  }

  @Get('me/classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my school classes with subject requirements' })
  async listMyClasses(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.listClasses(user.schoolAdmin.schoolId) };
  }

  @Post('me/classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a class in my school' })
  async createMyClass(@GetUser() user: SchoolAdminSession, @Body() dto: CreateSchoolClassDto) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.createClass(user.schoolAdmin.schoolId, dto) };
  }

  @Patch('me/classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a class in my school' })
  async updateMyClass(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateSchoolClassDto) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return { success: true, data: await this.schedulingService.updateClass(user.schoolAdmin.schoolId, id, dto) };
  }

  @Delete('me/classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a class in my school' })
  async deleteMyClass(@GetUser() user: SchoolAdminSession, @Param('id') id: string) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    await this.schedulingService.deleteClass(user.schoolAdmin.schoolId, id);
    return { success: true, message: 'Classe supprimée' };
  }

  @Post('me/classes/:classId/requirements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add a subject requirement (hours/week) to a class' })
  async createMyClassRequirement(
    @GetUser() user: SchoolAdminSession,
    @Param('classId') classId: string,
    @Body() dto: CreateSubjectRequirementDto,
  ) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return {
      success: true,
      data: await this.schedulingService.createRequirement(user.schoolAdmin.schoolId, classId, dto),
    };
  }

  @Patch('me/classes/:classId/requirements/:requirementId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a subject requirement' })
  async updateMyClassRequirement(
    @GetUser() user: SchoolAdminSession,
    @Param('classId') classId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: UpdateSubjectRequirementDto,
  ) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return {
      success: true,
      data: await this.schedulingService.updateRequirement(user.schoolAdmin.schoolId, classId, requirementId, dto),
    };
  }

  @Delete('me/classes/:classId/requirements/:requirementId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a subject requirement' })
  async deleteMyClassRequirement(
    @GetUser() user: SchoolAdminSession,
    @Param('classId') classId: string,
    @Param('requirementId') requirementId: string,
  ) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    await this.schedulingService.deleteRequirement(user.schoolAdmin.schoolId, classId, requirementId);
    return { success: true, message: 'Besoin horaire supprimé' };
  }

  @Put('me/classes/:classId/requirements/:requirementId/teacher')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign a qualified teacher to a subject requirement' })
  async assignMyClassRequirementTeacher(
    @GetUser() user: SchoolAdminSession,
    @Param('classId') classId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: AssignTeacherToRequirementDto,
  ) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    return {
      success: true,
      data: await this.schedulingService.assignTeacher(user.schoolAdmin.schoolId, classId, requirementId, dto),
    };
  }

  @Delete('me/classes/:classId/requirements/:requirementId/teacher')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unassign the teacher of a subject requirement' })
  async unassignMyClassRequirementTeacher(
    @GetUser() user: SchoolAdminSession,
    @Param('classId') classId: string,
    @Param('requirementId') requirementId: string,
  ) {
    if (!user.schoolAdmin) throw new ForbiddenException("Réservé aux administrateurs d'école");
    await this.schedulingService.unassignTeacher(user.schoolAdmin.schoolId, classId, requirementId);
    return { success: true, message: 'Professeur retiré' };
  }
}
