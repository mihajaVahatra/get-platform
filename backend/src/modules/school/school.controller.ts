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
import { CreateSchoolProgramDto, UpdateSchoolProgramDto } from './dto/school-program.dto';
import { CreateSchoolAcademicYearDto, UpdateSchoolAcademicYearDto } from './dto/school-academic-year.dto';

type SchoolAdminSession = {
  schoolAdmin?: {
    schoolId: string;
  };
};

@ApiTags('schools')
@Controller('schools')
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  // ========== PUBLIC ROUTES ==========

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

  @Get('me/subjects') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async getMySubjects(@GetUser() user: SchoolAdminSession) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.getSubjects(user.schoolAdmin.schoolId) }; }
  @Get('me/teachers/inactive') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async getMyInactiveTeachers(@GetUser() user: SchoolAdminSession) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.getInactiveTeacherAssignments(user.schoolAdmin.schoolId) }; }
  @Get('me/teachers/search') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async searchMyTeacher(@Query('email') email: string) { return { success: true, data: await this.schoolService.findTeacherByEmail(email) }; }
  @Post('me/subjects') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async createMySubject(@GetUser() user: SchoolAdminSession, @Body() body: { name: string }) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.createSubject(user.schoolAdmin.schoolId, body.name) }; }
  @Patch('me/subjects/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async updateMySubject(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() body: { isActive: boolean }) { if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable'); return { success: true, data: await this.schoolService.updateSubject(user.schoolAdmin.schoolId, id, body.isActive) }; }

  @Get('me/programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get school programs for my school' })
  async getMyPrograms(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.getPrograms(user.schoolAdmin.schoolId) };
  }

  @Post('me/programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a school program for my school' })
  async createMyProgram(@GetUser() user: SchoolAdminSession, @Body() dto: CreateSchoolProgramDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.createProgram(user.schoolAdmin.schoolId, dto) };
  }

  @Patch('me/programs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a school program for my school' })
  async updateMyProgram(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateSchoolProgramDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.updateProgram(user.schoolAdmin.schoolId, id, dto) };
  }

  @Get('me/academic-years')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get academic years for my school' })
  async getMyAcademicYears(@GetUser() user: SchoolAdminSession) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.getAcademicYears(user.schoolAdmin.schoolId) };
  }

  @Post('me/academic-years')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an academic year for my school' })
  async createMyAcademicYear(@GetUser() user: SchoolAdminSession, @Body() dto: CreateSchoolAcademicYearDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.createAcademicYear(user.schoolAdmin.schoolId, dto) };
  }

  @Patch('me/academic-years/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an academic year for my school' })
  async updateMyAcademicYear(@GetUser() user: SchoolAdminSession, @Param('id') id: string, @Body() dto: UpdateSchoolAcademicYearDto) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.updateAcademicYear(user.schoolAdmin.schoolId, id, dto) };
  }

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

  @Patch('me/students/:studentId') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async updateMySchoolStudentEnrollment(@GetUser() user: SchoolAdminSession, @Param('studentId') studentId: string, @Body() body: { programId?: string; level?: number; academicYearId?: string; status: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED' }) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.updateEnrollment(user.schoolAdmin.schoolId, studentId, body) };
  }

  @Post('me/students/enroll/bulk') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('SCHOOL_ADMIN')
  async bulkEnrollMySchoolStudents(@GetUser() user: SchoolAdminSession, @Body('rows') rows: Array<{ email: string; programName: string; level: number; academicYearLabel: string }>) {
    if (!user.schoolAdmin) throw new ForbiddenException('Profil administrateur introuvable');
    return { success: true, data: await this.schoolService.bulkEnrollStudents(user.schoolAdmin.schoolId, Array.isArray(rows) ? rows : []) };
  }

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

  @Get('me/requirements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  async getMyRequirements(@GetUser('id') userId: string, @Query('diploma') diploma?: string) {
    const admin = await this.prisma.schoolAdmin.findUnique({ where: { userId } });
    if (!admin) throw new ForbiddenException('Profil administrateur introuvable');
    return this.prisma.schoolRequirement.findMany({ where: { schoolId: admin.schoolId, isActive: true, ...(diploma ? { OR: [{ diploma }, { diploma: null }] } : {}) }, orderBy: { name: 'asc' } });
  }

  @Post('me/requirements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  async createMyRequirement(@GetUser('id') userId: string, @Body() body: { name: string; description?: string; type?: string; diploma?: string; isRequired?: boolean }) {
    const admin = await this.prisma.schoolAdmin.findUnique({ where: { userId } });
    if (!admin) throw new ForbiddenException('Profil administrateur introuvable');
    return this.prisma.schoolRequirement.create({ data: { schoolId: admin.schoolId, name: body.name, description: body.description, type: body.type || 'DOCUMENT', diploma: body.diploma, isRequired: body.isRequired ?? true } });
  }

  @Patch('me/requirements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  async updateMyRequirement(@GetUser('id') userId: string, @Param('id') id: string, @Body() body: { name?: string; description?: string; type?: string; isRequired?: boolean; isActive?: boolean }) {
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
}
