import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { IsIn, IsString, Matches, MinLength } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentService } from './student.service';
import {
  StorageService,
  ImageEntityType,
  ImageType,
} from '../../common/services/storage.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { OrientationQuestionnaireDto } from './dto/orientation-questionnaire.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

type CurrentStudentUser = {
  id: string;
  student?: { id: string } | null;
};

/** Changement de mot de passe : exige l'ancien mot de passe et une politique de complexité pour le nouveau. */
class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString()
  @MinLength(8)
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

/**
 * Expose l'API "espace étudiant" : profil, avatar, cours/devoirs,
 * documents, orientation, statistiques, notes, emploi du temps et
 * préférences de sécurité/thème.
 *
 * Toutes les routes exigent un utilisateur authentifié avec le rôle
 * STUDENT (JwtAuthGuard + RolesGuard + @Roles('STUDENT')). En plus de ce
 * contrôle de rôle global, chaque méthode vérifie explicitement que
 * `user.student` est bien renseigné (l'utilisateur possède un profil
 * étudiant lié) et lève une ForbiddenException sinon.
 */
@ApiTags('students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT')
@ApiBearerAuth('access-token')
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly storageService: StorageService,
  ) {}

  // ========== PROFILE ==========

  /**
   * Récupère le profil complet de l'étudiant connecté (infos personnelles
   * déchiffrées, documents, candidatures récentes, inscriptions actives).
   * Lève ForbiddenException si l'utilisateur n'a pas de profil étudiant,
   * NotFoundException si le profil est introuvable en base.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current student profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Student not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getProfile(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const profile = await this.studentService.getProfile(user.id);
    return {
      success: true,
      data: profile,
      message: 'Profile retrieved successfully',
    };
  }

  /**
   * Met à jour les champs modifiables du profil étudiant (identité,
   * coordonnées, bio, centres d'intérêt...). `phone` et `cin` sont
   * rechiffrés côté service avant écriture. Lève BadRequestException si le
   * chiffrement échoue, ForbiddenException si l'utilisateur n'est pas
   * étudiant.
   */
  @Put('me')
  @ApiOperation({ summary: 'Update student profile' })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid data' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async updateProfile(
    @GetUser() user: any,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const profile = await this.studentService.updateProfile(user.id, dto);
    return {
      success: true,
      data: profile,
      message: 'Profile updated successfully',
    };
  }

  // ========== AVATAR ==========

  /**
   * Upload de l'avatar de l'étudiant (JPEG/PNG/WEBP, 5 Mo max). Stocke
   * l'image via StorageService puis met à jour l'URL en base. Lève
   * BadRequestException si le format n'est pas autorisé ou si aucun fichier
   * n'est fourni.
   */
  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload student avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Avatar uploaded' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file' })
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
  async uploadAvatar(
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user.student) {
      throw new ForbiddenException('Réservé aux étudiants');
    }
    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }

    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.STUDENT,
      entityId: user.student.id,
      type: ImageType.AVATAR,
    });

    await this.studentService.updateAvatar(user.id, result.url);

    return {
      success: true,
      data: { avatarUrl: result.url },
      message: 'Avatar uploaded successfully',
    };
  }

  // ========== COURS ET DEVOIRS ==========

  /** Liste les cours auxquels l'étudiant connecté est inscrit. */
  @Get('me/courses')
  @ApiOperation({ summary: 'Get courses the current student is enrolled in' })
  async getCourses(@GetUser() user: CurrentStudentUser) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const courses = await this.studentService.getCourses(user.id);
    return { success: true, data: courses, message: 'Courses retrieved' };
  }

  /**
   * Liste les devoirs publiés d'un cours, avec la soumission de l'étudiant
   * (si elle existe) rattachée à chacun. Vérifie que l'étudiant est bien
   * inscrit au cours (NotFoundException sinon).
   */
  @Get('me/courses/:courseId/assignments')
  @ApiOperation({ summary: 'Get published assignments for an enrolled course' })
  async getCourseAssignments(
    @GetUser() user: CurrentStudentUser,
    @Param('courseId') courseId: string,
  ) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const assignments = await this.studentService.getCourseAssignments(
      user.id,
      courseId,
    );
    return {
      success: true,
      data: assignments,
      message: 'Assignments retrieved',
    };
  }

  /**
   * Dépose (ou remplace) la soumission d'un devoir publié (PDF/JPG/PNG/
   * DOC/DOCX, 5 Mo max). Refuse le remplacement si la soumission existante
   * a déjà été notée (ConflictException, voir StudentService.submitAssignment).
   * Lève NotFoundException si le devoir n'existe pas ou n'est pas publié.
   */
  @Post('me/assignments/:assignmentId/submit')
  @ApiOperation({
    summary: 'Submit or replace an ungraded assignment submission',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedMimes.includes(file.mimetype)) return cb(null, true);
        return cb(
          new BadRequestException(
            'Formats acceptés : PDF, JPG, PNG, DOC, DOCX',
          ),
          false,
        );
      },
    }),
  )
  async submitAssignment(
    @GetUser() user: CurrentStudentUser,
    @Param('assignmentId') assignmentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    if (!file) throw new BadRequestException('Aucun fichier uploadé');
    const submission = await this.studentService.submitAssignment(
      user.id,
      assignmentId,
      file,
    );
    return { success: true, data: submission, message: 'Assignment submitted' };
  }

  // ========== DOCUMENTS ==========

  /** Liste les documents (non supprimés) de l'étudiant connecté. */
  @Get('me/documents')
  @ApiOperation({ summary: 'Get all documents' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents retrieved' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getDocuments(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const documents = await this.studentService.getDocuments(user.id);
    return {
      success: true,
      data: documents,
      message: 'Documents retrieved',
    };
  }

  /**
   * Upload d'un document étudiant (CV, lettre, pièce d'identité, diplôme,
   * photo, autre). Formats acceptés : PDF, JPG, PNG, DOC, DOCX, 5 Mo max.
   * Lève BadRequestException si le fichier est manquant, trop volumineux ou
   * dans un format non supporté.
   */
  @Post('me/documents')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: ['CV', 'LETTER', 'ID', 'DIPLOMA', 'PHOTO', 'OTHER'],
        },
        name: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Document uploaded' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'File too large or unsupported format',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Unsupported file format. Accepted: PDF, JPG, PNG, DOC, DOCX',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadDocument(
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const document = await this.studentService.uploadDocument(
      user.id,
      file,
      dto,
    );
    return {
      success: true,
      data: document,
      message: 'Document uploaded successfully',
    };
  }

  /**
   * Suppression logique d'un document (soft delete via `deletedAt`).
   * Lève NotFoundException si le document n'existe pas ou n'appartient pas
   * à l'étudiant connecté.
   */
  @Delete('me/documents/:id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Document deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Document not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async deleteDocument(@GetUser() user: any, @Param('id') documentId: string) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    await this.studentService.deleteDocument(user.id, documentId);
    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  // ========== ORIENTATION ==========

  /**
   * Enregistre les réponses du questionnaire d'orientation (intérêts,
   * compétences, objectifs de carrière) sur le profil étudiant, puis
   * retourne des suggestions de formations calculées à partir de ces
   * réponses.
   */
  @Post('me/orientation')
  @ApiOperation({ summary: 'Submit orientation questionnaire' })
  @ApiBody({ type: OrientationQuestionnaireDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Questionnaire submitted',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async submitOrientationQuestionnaire(
    @GetUser() user: any,
    @Body() dto: OrientationQuestionnaireDto,
  ) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const suggestions =
      await this.studentService.submitOrientationQuestionnaire(user.id, dto);
    return {
      success: true,
      data: { suggestions },
      message: 'Questionnaire submitted successfully',
    };
  }

  /**
   * Recalcule les suggestions d'orientation à partir des réponses déjà
   * enregistrées. Lève BadRequestException si l'étudiant n'a pas encore
   * complété le questionnaire (aucun intérêt enregistré).
   */
  @Get('me/orientation')
  @ApiOperation({ summary: 'Get orientation suggestions' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Orientation suggestions retrieved',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getOrientationSuggestions(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const suggestions = await this.studentService.getOrientationSuggestions(
      user.id,
    );
    return {
      success: true,
      data: { suggestions },
      message: 'Orientation suggestions retrieved',
    };
  }

  // ========== STATISTICS ==========

  /**
   * Retourne des statistiques personnelles agrégées (candidatures par
   * statut, nombre de documents, taux de complétion du profil).
   */
  @Get('me/stats')
  @ApiOperation({ summary: 'Get personal statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getStudentStats(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const stats = await this.studentService.getStudentStats(user.id);
    return {
      success: true,
      data: stats,
      message: 'Statistics retrieved',
    };
  }

  // ========== GRADES ==========

  /**
   * Liste les notes de l'étudiant pour tous ses cours inscrits : notes
   * d'évaluations (avec coefficient) et notes de devoirs soumis.
   */
  @Get('me/grades')
  @ApiOperation({ summary: 'Get grades for all enrolled courses' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Grades retrieved' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getGrades(@GetUser() user: CurrentStudentUser) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const grades = await this.studentService.getGrades(user.id);
    return { success: true, data: grades, message: 'Grades retrieved' };
  }

  // ========== SCHEDULE ==========

  /** Retourne l'emploi du temps hebdomadaire des cours auxquels l'étudiant est inscrit. */
  @Get('me/schedule')
  @ApiOperation({ summary: 'Get weekly schedule for enrolled courses' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Schedule retrieved' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getSchedule(@GetUser() user: CurrentStudentUser) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const schedule = await this.studentService.getSchedule(user.id);
    return { success: true, data: schedule, message: 'Schedule retrieved' };
  }

  // ========== ÉVÉNEMENTS ==========

  /** Retourne les événements à venir des écoles où l'étudiant est activement inscrit. */
  @Get('me/events')
  @ApiOperation({ summary: 'Get upcoming events for enrolled schools' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Events retrieved' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a student',
  })
  async getUpcomingEvents(@GetUser() user: CurrentStudentUser) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const events = await this.studentService.getUpcomingEvents(user.id);
    return { success: true, data: events, message: 'Events retrieved' };
  }

  // ========== SECURITY & PREFERENCES ==========

  /**
   * Change le mot de passe de l'étudiant après vérification du mot de
   * passe actuel. Lève BadRequestException si l'ancien mot de passe est
   * incorrect.
   */
  @Patch('me/password')
  @ApiOperation({ summary: 'Change current student password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Current password is incorrect',
  })
  async changePassword(@GetUser() user: any, @Body() dto: ChangePasswordDto) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const result = await this.studentService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true, data: result, message: 'Password changed' };
  }

  /** Met à jour la préférence de thème (clair/sombre/système) de l'utilisateur. */
  @Patch('me/theme')
  @ApiOperation({ summary: 'Update theme preference' })
  @ApiBody({ type: UpdateThemeDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Theme updated' })
  async updateTheme(@GetUser() user: any, @Body() dto: UpdateThemeDto) {
    if (!user.student) {
      throw new ForbiddenException(
        'Cette fonctionnalité est réservée aux étudiants',
      );
    }
    const result = await this.studentService.updateTheme(user.id, dto.theme);
    return { success: true, data: result, message: 'Theme updated' };
  }
}
