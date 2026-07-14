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
  NotFoundException,
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
  ApplicationStatus,
} from './dto/update-application-status.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';

@ApiTags('applications')
@Controller('applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit applications to multiple offers' })
  @ApiBody({ type: SubmitApplicationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Applications submitted',
    type: BulkApplicationResponseDto,
  })
  async submitApplications(
    @GetUser('id') userId: string,
    @Body() dto: SubmitApplicationDto,
  ) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student profile not found');
    const result = await this.applicationService.submitApplications(student.id, dto.offerIds);
    return {
      success: true,
      data: result,
      message: 'Applications submitted successfully',
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my applications' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiPaginatedResponse(ApplicationResponseDto)
  async getMyApplications(
    @GetUser('id') userId: string,
    @Query('status') status?: ApplicationStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student profile not found');
    const result = await this.applicationService.getStudentApplications(student.id, {
      status,
      page,
      limit,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Applications retrieved successfully',
    };
  }

  @Get('school/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get applications for my school' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  @ApiQuery({ name: 'offerId', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiPaginatedResponse(ApplicationResponseDto)
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

  @Get(':id')
  @ApiOperation({ summary: 'Get application details' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Application details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  async getApplication(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
  ) {
    const application = await this.applicationService.getApplicationById(id, userId, role);
    return {
      success: true,
      data: application,
      message: 'Application retrieved successfully',
    };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Update application status' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiBody({ type: UpdateApplicationStatusDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @GetUser('id') userId: string,
  ) {
    const application = await this.applicationService.updateStatus(id, dto, userId);
    return {
      success: true,
      data: application,
      message: 'Status updated successfully',
    };
  }

  @Post(':id/schedule-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiOperation({ summary: 'Schedule a test for a candidate' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiBody({
    schema: {
      properties: {
        date: { type: 'string', example: '2024-02-10T10:00:00Z' },
        type: { type: 'string', example: 'QCM' },
        details: { type: 'string', example: 'Logic test' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Test scheduled' })
  async scheduleTest(
    @Param('id') id: string,
    @Body('date') date: string,
    @Body('type') type: string,
    @Body('details') details: string,
    @GetUser('id') userId: string,
  ) {
    const application = await this.applicationService.scheduleTest(
      id,
      { date: new Date(date), type, details },
      userId,
    );
    return {
      success: true,
      data: application,
      message: 'Test scheduled successfully',
    };
  }

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
    const application = await this.applicationService.scheduleInterview(id, dto, userId);
    return {
      success: true,
      data: application,
      message: 'Interview scheduled successfully',
    };
  }

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
}
