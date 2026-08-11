import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeachingService } from './teaching.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ImageEntityType,
  ImageType,
  StorageService,
} from '../../common/services/storage.service';
/** Champs modifiables du profil enseignant (mise à jour partielle). */
class UpdateTeacherProfileDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
/** Changement de mot de passe : exige l'ancien mot de passe et une politique de complexité pour le nouveau. */
export class ChangePasswordDto {
  @IsString() currentPassword: string;
  // Borne haute alignée sur RegisterDto.password : bcrypt.hash tronque
  // silencieusement tout au-delà de 72 octets sans erreur ni avertissement —
  // sans cette limite, un mot de passe plus long semblerait accepté mais
  // seuls ses 72 premiers octets compteraient réellement à la vérification
  // (faille corrigée suite à l'audit sécurité).
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&)',
    },
  )
  newPassword: string;
}
/** Préférence d'apparence de l'interface, limitée aux trois valeurs supportées. */
class UpdateThemeDto {
  @IsIn(['light', 'dark', 'system'])
  theme: string;
}
/** Paramètres de fonctionnement d'un cours contrôlés par l'enseignant. */
class UpdateCourseSettingsDto {
  @IsOptional() @IsString() @MaxLength(2000) welcomeMessage?: string;
  @IsOptional() @IsBoolean() allowGroupMessages?: boolean;
  @IsOptional() @IsBoolean() notifyOnPublish?: boolean;
}
/** Annonce diffusée à tous les étudiants inscrits à un cours. */
class CourseAnnouncementDto {
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(5000) body: string;
}
/** Création d'un chapitre de cours. */
class ChapterDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}
/** Mise à jour partielle d'un chapitre existant. */
class UpdateChapterDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}
/** Ressource pédagogique d'un chapitre : soit une URL, soit un fichier uploadé (voir contrôleur). */
class ResourceDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsString() @MaxLength(30) type: string;
}
/** Mise à jour partielle d'une ressource existante. */
class UpdateResourceDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsOptional() @IsString() @MaxLength(30) type?: string;
}
/** Création d'une évaluation (examen, contrôle...) pour un cours. */
class EvaluationDto {
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(50) type: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) coefficient?: number;
}
/** Note attribuée à un étudiant pour une évaluation donnée. */
class GradeDto {
  @IsString() studentId: string;
  @Type(() => Number) @IsNumber() value: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
/** Création d'un devoir (non publié par défaut, voir TeachingService.createAssignment). */
class AssignmentDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) instructions?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
/** Note et retour attribués à une soumission d'étudiant. */
class SubmissionGradeDto {
  @Type(() => Number) @IsNumber() grade: number;
  @IsOptional() @IsString() @MaxLength(2000) feedback?: string;
}
/**
 * API "espace enseignant" pour la gestion des cours dont l'enseignant a la
 * charge : liste des cours/écoles/emploi du temps, détail d'un cours,
 * paramètres, étudiants inscrits, évaluations, annonces, devoirs,
 * chapitres et ressources pédagogiques.
 *
 * Toutes les routes exigent un utilisateur authentifié avec le rôle
 * TEACHER. Chaque méthode de TeachingService qui prend un `courseId`
 * vérifie en interne que le cours appartient bien à l'enseignant connecté
 * (et que son affectation à l'école est active) avant toute opération.
 */
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/courses')
export class TeachingController {
  constructor(private readonly teaching: TeachingService) {}
  /** Liste les cours de l'enseignant connecté (écoles actives uniquement). */
  @Get() courses(@GetUser('id') id: string) {
    return this.teaching.courses(id);
  }
  /** Liste les écoles où l'enseignant a une affectation active. */
  @Get('schools') schools(@GetUser('id') id: string) {
    return this.teaching.schools(id);
  }
  /** Retourne l'emploi du temps de tous les cours de l'enseignant. */
  @Get('schedule') schedule(@GetUser('id') id: string) {
    return this.teaching.schedule(id);
  }
  /** Liste paginée des ressources pédagogiques de tous les cours de l'enseignant. */
  @Get('resources') resources(
    @GetUser('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teaching.resources(id, page, limit);
  }
  /** Détail d'un cours : chapitres (avec ressources), évaluations, devoirs. Lève NotFoundException si le cours n'appartient pas à l'enseignant. */
  @Get(':courseId') detail(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.detail(id, courseId);
  }
  /** Met à jour les paramètres d'un cours (message de bienvenue, messages de groupe, notifications). */
  @Patch(':courseId/settings') updateSettings(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseSettingsDto,
  ) {
    return this.teaching.updateCourseSettings(id, courseId, dto);
  }
  /** Liste paginée des étudiants inscrits à un cours. */
  @Get(':courseId/students') students(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teaching.students(id, courseId, page, limit);
  }
  /** Liste les évaluations d'un cours. */
  @Get(':courseId/evaluations') evaluations(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.evaluations(id, courseId);
  }
  /** Liste les annonces déjà publiées pour un cours, avec le nombre de destinataires et de lectures. */
  @Get(':courseId/announcements') announcements(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.announcements(id, courseId);
  }
  /** Publie une annonce à destination de tous les étudiants inscrits au cours (crée aussi leurs notifications). */
  @Post(':courseId/announcements') announcement(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: CourseAnnouncementDto,
  ) {
    return this.teaching.createAnnouncement(id, courseId, dto);
  }
  /** Crée une nouvelle évaluation pour un cours. */
  @Post(':courseId/evaluations') evaluation(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: EvaluationDto,
  ) {
    return this.teaching.createEvaluation(id, courseId, dto);
  }
  /** Crée un devoir (non publié : les étudiants ne le voient qu'après publication explicite). */
  @Post(':courseId/assignments') assignment(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: AssignmentDto,
  ) {
    return this.teaching.createAssignment(id, courseId, dto);
  }
  /** Crée un chapitre, ajouté en fin de plan de cours (position auto-incrémentée). */
  @Post(':courseId/chapters') chapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: ChapterDto,
  ) {
    return this.teaching.createChapter(id, courseId, dto);
  }
  /** Publie un chapitre (le rend visible aux étudiants inscrits). */
  @Patch(':courseId/chapters/:chapterId/publish') publish(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.teaching.publishChapter(id, courseId, chapterId);
  }
  /** Met à jour le titre/description d'un chapitre. */
  @Patch(':courseId/chapters/:chapterId') updateChapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.teaching.updateChapter(id, courseId, chapterId, dto);
  }
  /** Supprime un chapitre (et, via la contrainte DB, ses ressources associées). */
  @Delete(':courseId/chapters/:chapterId') deleteChapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.teaching.deleteChapter(id, courseId, chapterId);
  }
  /**
   * Ajoute une ressource à un chapitre : soit un lien externe (`dto.url`),
   * soit un fichier uploadé (prioritaire si les deux sont fournis, voir
   * TeachingService.addResource). Formats acceptés : PDF, images, Office,
   * ZIP, 20 Mo max.
   * @throws BadRequestException si ni lien ni fichier ne sont fournis, ou
   *   si le format du fichier n'est pas autorisé.
   */
  @Post(':courseId/chapters/:chapterId/resources')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip',
          'application/x-zip-compressed',
        ];
        if (allowedMimes.includes(file.mimetype)) return cb(null, true);
        return cb(
          new BadRequestException('Format de ressource non autorisé'),
          false,
        );
      },
    }),
  )
  resource(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: ResourceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!dto.url && !file) {
      throw new BadRequestException('Ajoutez un lien ou un fichier');
    }
    return this.teaching.addResource(id, courseId, chapterId, dto, file);
  }
  /** Met à jour le titre/URL/type d'une ressource existante. */
  @Patch(':courseId/chapters/:chapterId/resources/:resourceId') updateResource(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.teaching.updateResource(
      id,
      courseId,
      chapterId,
      resourceId,
      dto,
    );
  }
  /** Supprime une ressource d'un chapitre. */
  @Delete(':courseId/chapters/:chapterId/resources/:resourceId') deleteResource(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.teaching.deleteResource(id, courseId, chapterId, resourceId);
  }
}

/**
 * Profil, tableau de bord et préférences de compte de l'enseignant
 * connecté (rôle TEACHER requis).
 */
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher')
export class TeacherProfileController {
  constructor(
    private readonly teaching: TeachingService,
    private readonly storageService: StorageService,
  ) {}

  /** Récupère le profil de l'enseignant connecté. */
  @Get('profile')
  profile(@GetUser('id') id: string) {
    return this.teaching.profile(id);
  }

  /** Résumé chiffré du tableau de bord : nombre de cours, d'étudiants, de soumissions à noter, d'évaluations à venir et de messages non lus. */
  @Get('dashboard/summary')
  dashboardSummary(@GetUser('id') id: string) {
    return this.teaching.dashboardSummary(id);
  }

  /** Met à jour les informations de profil (nom, prénom, téléphone). */
  @Patch('profile')
  updateProfile(
    @GetUser('id') id: string,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.teaching.updateProfile(id, dto);
  }

  /**
   * Change le mot de passe après vérification de l'ancien.
   * @throws BadRequestException si le mot de passe actuel est incorrect.
   */
  @Patch('profile/password')
  changePassword(@GetUser('id') id: string, @Body() dto: ChangePasswordDto) {
    return this.teaching.changePassword(
      id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** Met à jour la préférence de thème de l'interface. */
  @Patch('profile/theme')
  updateTheme(@GetUser('id') id: string, @Body() dto: UpdateThemeDto) {
    return this.teaching.updateTheme(id, dto.theme);
  }

  /**
   * Upload l'avatar de l'enseignant (JPG/PNG/WEBP, 5 Mo max).
   * @throws BadRequestException si aucun fichier n'est fourni ou si le
   *   format n'est pas autorisé.
   */
  @Post('profile/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Seules les images JPG, PNG et WEBP sont autorisées',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadAvatar(
    @GetUser('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier uploadé');
    const teacher = await this.teaching.profile(id);
    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.TEACHER,
      entityId: teacher.id,
      type: ImageType.AVATAR,
    });
    const profile = await this.teaching.updateAvatar(id, result.url);
    return { avatarUrl: profile.avatarUrl };
  }
}

/** Gestion des notes d'une évaluation par l'enseignant qui possède le cours associé. */
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/evaluations')
export class TeacherEvaluationsController {
  constructor(private readonly teaching: TeachingService) {}

  /** Liste paginée des étudiants inscrits au cours de l'évaluation, avec leur note (ou null si pas encore notée). */
  @Get(':evaluationId/grades') grades(
    @GetUser('id') id: string,
    @Param('evaluationId') evaluationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teaching.grades(id, evaluationId, page, limit);
  }

  /**
   * Enregistre (crée ou met à jour) la note d'un étudiant pour une
   * évaluation. Lève NotFoundException si l'étudiant n'est pas inscrit au
   * cours de l'évaluation.
   */
  @Post(':evaluationId/grades') saveGrade(
    @GetUser('id') id: string,
    @Param('evaluationId') evaluationId: string,
    @Body() dto: GradeDto,
  ) {
    return this.teaching.saveGrade(id, evaluationId, dto);
  }
}

/** Gestion des devoirs (publication, consultation des soumissions) par l'enseignant qui possède le cours associé. */
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/assignments')
export class TeacherAssignmentsController {
  constructor(private readonly teaching: TeachingService) {}

  /** Publie un devoir, le rendant visible et soumissible par les étudiants inscrits. */
  @Patch(':assignmentId/publish') publish(
    @GetUser('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.teaching.publishAssignment(id, assignmentId);
  }

  /** Liste les soumissions reçues pour un devoir, de la plus récente à la plus ancienne. */
  @Get(':assignmentId/submissions') submissions(
    @GetUser('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.teaching.submissions(id, assignmentId);
  }
}

/** Notation d'une soumission d'étudiant par l'enseignant qui possède le cours associé. */
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/submissions')
export class TeacherSubmissionsController {
  constructor(private readonly teaching: TeachingService) {}

  /** Attribue une note et un retour à une soumission de devoir. */
  @Patch(':submissionId/grade') grade(
    @GetUser('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: SubmissionGradeDto,
  ) {
    return this.teaching.gradeSubmission(id, submissionId, dto);
  }
}
