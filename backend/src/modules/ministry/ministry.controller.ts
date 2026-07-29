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
} from '@nestjs/swagger';
import { MinistryService } from './ministry.service';
import {
  GenerateReportDto,
  ReportType,
  ExportFormat,
} from './dto/report-request.dto';
import { ComplianceUpdateDto } from './dto/compliance-update.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import {
  DashboardDto,
  ApplicationStatsDto,
  SchoolStatsDto,
} from './dto/ministry-stats.dto';

@ApiTags('ministry')
@Controller('ministry')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MINISTRY', 'ADMIN_GET')
@ApiBearerAuth('access-token')
export class MinistryController {
  constructor(private readonly ministryService: MinistryService) {}

  // ============================================================
  // 1. DASHBOARD
  // ============================================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get national dashboard data' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard data retrieved',
    type: DashboardDto,
  })
  async getDashboard(@Query('from') from?: string, @Query('to') to?: string) {
    const data = await this.ministryService.getDashboard({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return {
      success: true,
      data,
      message: 'Dashboard retrieved successfully',
    };
  }

  // ============================================================
  // 2. STATISTIQUES
  // ============================================================

  @Get('stats/applications')
  @ApiOperation({ summary: 'Get detailed application statistics' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'filiere', required: false })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application statistics',
    type: ApplicationStatsDto,
  })
  async getApplicationStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('region') region?: string,
    @Query('filiere') filiere?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const stats = await this.ministryService.getApplicationStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      region,
      filiere,
      schoolId,
    });
    return {
      success: true,
      data: stats,
      message: 'Application statistics retrieved successfully',
    };
  }

  @Get('stats/schools')
  @ApiOperation({ summary: 'Get school statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'School statistics',
    type: SchoolStatsDto,
  })
  async getSchoolStats() {
    const stats = await this.ministryService.getSchoolStats();
    return {
      success: true,
      data: stats,
      message: 'School statistics retrieved successfully',
    };
  }

  @Get('stats/geographic')
  @ApiOperation({ summary: 'Get geographic distribution of students' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic data for mapping',
  })
  async getGeographicStats() {
    const data = await this.ministryService.getGeographicStats();
    return {
      success: true,
      data,
      message: 'Geographic statistics retrieved successfully',
    };
  }

  // ============================================================
  // 3. CONFORMITÉ
  // ============================================================

  @Get('compliance')
  @ApiOperation({ summary: 'Get compliance checks list' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PASSED', 'FAILED', 'PENDING'],
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compliance checks retrieved',
  })
  async getCompliance(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.ministryService.getCompliance({
      status,
      page,
      limit,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Compliance checks retrieved successfully',
    };
  }

  @Put('compliance/:schoolId')
  @ApiOperation({ summary: 'Update compliance status for a school' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiBody({ type: ComplianceUpdateDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Compliance updated' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  async updateCompliance(
    @Param('schoolId') schoolId: string,
    @Body() dto: ComplianceUpdateDto,
    @GetUser('id') userId?: string,
  ) {
    const result = await this.ministryService.updateCompliance(
      schoolId,
      dto,
      userId,
    );
    return {
      success: true,
      data: result,
      message: 'Compliance updated successfully',
    };
  }

  // ============================================================
  // 4. RAPPORTS
  // ============================================================

  @Get('reports')
  @ApiOperation({ summary: 'Get list of generated reports' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['NATIONAL', 'REGIONAL', 'SECTORIAL'],
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reports list retrieved' })
  async getReports(
    @Query('type') type?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    let reportType: ReportType | undefined;
    if (type && Object.values(ReportType).includes(type as ReportType)) {
      reportType = type as ReportType;
    }
    const result = await this.ministryService.getReports({
      type: reportType,
      page,
      limit,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Reports retrieved successfully',
    };
  }

  @Post('reports/generate')
  @ApiOperation({ summary: 'Generate a new report' })
  @ApiBody({ type: GenerateReportDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Report generation started',
  })
  async generateReport(
    @Body() dto: GenerateReportDto,
    @GetUser('id') userId?: string,
  ) {
    const result = await this.ministryService.generateReport(dto, userId);
    return {
      success: true,
      data: result,
      message: 'Report generation started',
    };
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get report details' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report details retrieved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found',
  })
  async getReport(@Param('id') id: string) {
    const report = await this.ministryService.getReport(id);
    return {
      success: true,
      data: report,
      message: 'Report retrieved successfully',
    };
  }

  @Get('reports/:id/export')
  @ApiOperation({ summary: 'Export a report' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiQuery({
    name: 'format',
    enum: ['PDF', 'EXCEL', 'CSV', 'JSON'],
    default: 'PDF',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'File exported' })
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: ExportFormat = ExportFormat.PDF,
  ) {
    const { buffer, contentType } = await this.ministryService.exportReport(
      id,
      format,
    );
    const extension = format.toLowerCase();
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="report-${id}.${extension}"`,
    });
  }

  // ============================================================
  // 5. STATISTIQUES PUBLIQUES (API ouverte)
  // ============================================================

  @Get('public/stats')
  @ApiOperation({ summary: 'Public statistics (no authentication required)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Public statistics retrieved',
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
      message: 'Public statistics retrieved successfully',
    };
  }
}
