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
class UpdateTeacherProfileDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
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
class UpdateThemeDto {
  @IsIn(['light', 'dark', 'system'])
  theme: string;
}
class UpdateCourseSettingsDto {
  @IsOptional() @IsString() @MaxLength(2000) welcomeMessage?: string;
  @IsOptional() @IsBoolean() allowGroupMessages?: boolean;
  @IsOptional() @IsBoolean() notifyOnPublish?: boolean;
}
class CourseAnnouncementDto {
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(5000) body: string;
}
class ChapterDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}
class UpdateChapterDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}
class ResourceDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsString() @MaxLength(30) type: string;
}
class UpdateResourceDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsOptional() @IsString() @MaxLength(30) type?: string;
}
class EvaluationDto {
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(50) type: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) coefficient?: number;
}
class GradeDto {
  @IsString() studentId: string;
  @Type(() => Number) @IsNumber() value: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
class AssignmentDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) instructions?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
class SubmissionGradeDto {
  @Type(() => Number) @IsNumber() grade: number;
  @IsOptional() @IsString() @MaxLength(2000) feedback?: string;
}
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/courses')
export class TeachingController {
  constructor(private readonly teaching: TeachingService) {}
  @Get() courses(@GetUser('id') id: string) {
    return this.teaching.courses(id);
  }
  @Get('schools') schools(@GetUser('id') id: string) {
    return this.teaching.schools(id);
  }
  @Get('schedule') schedule(@GetUser('id') id: string) {
    return this.teaching.schedule(id);
  }
  @Get('resources') resources(
    @GetUser('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teaching.resources(id, page, limit);
  }
  @Get(':courseId') detail(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.detail(id, courseId);
  }
  @Patch(':courseId/settings') updateSettings(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseSettingsDto,
  ) {
    return this.teaching.updateCourseSettings(id, courseId, dto);
  }
  @Get(':courseId/students') students(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teaching.students(id, courseId, page, limit);
  }
  @Get(':courseId/evaluations') evaluations(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.evaluations(id, courseId);
  }
  @Get(':courseId/announcements') announcements(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.announcements(id, courseId);
  }
  @Post(':courseId/announcements') announcement(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: CourseAnnouncementDto,
  ) {
    return this.teaching.createAnnouncement(id, courseId, dto);
  }
  @Post(':courseId/evaluations') evaluation(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: EvaluationDto,
  ) {
    return this.teaching.createEvaluation(id, courseId, dto);
  }
  @Post(':courseId/assignments') assignment(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: AssignmentDto,
  ) {
    return this.teaching.createAssignment(id, courseId, dto);
  }
  @Post(':courseId/chapters') chapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: ChapterDto,
  ) {
    return this.teaching.createChapter(id, courseId, dto);
  }
  @Patch(':courseId/chapters/:chapterId/publish') publish(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.teaching.publishChapter(id, courseId, chapterId);
  }
  @Patch(':courseId/chapters/:chapterId') updateChapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.teaching.updateChapter(id, courseId, chapterId, dto);
  }
  @Delete(':courseId/chapters/:chapterId') deleteChapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.teaching.deleteChapter(id, courseId, chapterId);
  }
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
  @Delete(':courseId/chapters/:chapterId/resources/:resourceId') deleteResource(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.teaching.deleteResource(id, courseId, chapterId, resourceId);
  }
}

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

  @Get('profile')
  profile(@GetUser('id') id: string) {
    return this.teaching.profile(id);
  }

  @Get('dashboard/summary')
  dashboardSummary(@GetUser('id') id: string) {
    return this.teaching.dashboardSummary(id);
  }

  @Patch('profile')
  updateProfile(
    @GetUser('id') id: string,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.teaching.updateProfile(id, dto);
  }

  @Patch('profile/password')
  changePassword(@GetUser('id') id: string, @Body() dto: ChangePasswordDto) {
    return this.teaching.changePassword(
      id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Patch('profile/theme')
  updateTheme(@GetUser('id') id: string, @Body() dto: UpdateThemeDto) {
    return this.teaching.updateTheme(id, dto.theme);
  }

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

@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/evaluations')
export class TeacherEvaluationsController {
  constructor(private readonly teaching: TeachingService) {}

  @Get(':evaluationId/grades') grades(
    @GetUser('id') id: string,
    @Param('evaluationId') evaluationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.teaching.grades(id, evaluationId, page, limit);
  }

  @Post(':evaluationId/grades') saveGrade(
    @GetUser('id') id: string,
    @Param('evaluationId') evaluationId: string,
    @Body() dto: GradeDto,
  ) {
    return this.teaching.saveGrade(id, evaluationId, dto);
  }
}

@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/assignments')
export class TeacherAssignmentsController {
  constructor(private readonly teaching: TeachingService) {}

  @Patch(':assignmentId/publish') publish(
    @GetUser('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.teaching.publishAssignment(id, assignmentId);
  }

  @Get(':assignmentId/submissions') submissions(
    @GetUser('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.teaching.submissions(id, assignmentId);
  }
}

@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/submissions')
export class TeacherSubmissionsController {
  constructor(private readonly teaching: TeachingService) {}

  @Patch(':submissionId/grade') grade(
    @GetUser('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: SubmissionGradeDto,
  ) {
    return this.teaching.gradeSubmission(id, submissionId, dto);
  }
}
