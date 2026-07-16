import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  ForbiddenException,
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
import { SchoolService } from './school.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';

@ApiTags('schools')
@Controller('schools')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

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
    const result = await this.schoolService.findAll(page, limit, { city, type, search });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Schools retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get school details' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'School details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'School not found' })
  async getSchool(@Param('id') id: string) {
    const school = await this.schoolService.findOne(id);
    return {
      success: true,
      data: school,
      message: 'School retrieved successfully',
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
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied - Admin required' })
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
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'School not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async updateSchool(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolDto,
    @GetUser() user: any,
  ) {
    // ✅ Vérifier que l'utilisateur est admin GET ou schoolAdmin de cette école
    const isAdminGet = user.role === 'ADMIN_GET';
    const isSchoolAdmin = user.schoolAdmin && user.schoolAdmin.schoolId === id;

    if (!isAdminGet && !isSchoolAdmin) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à modifier cette école');
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
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'School not found' })
  async deleteSchool(@Param('id') id: string, @GetUser() user: any) {
    await this.schoolService.delete(id, user.id);
    return {
      success: true,
      message: 'School deleted successfully',
    };
  }

  // ========== SCHOOL ADMIN ROUTES ==========

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current school info (School Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'School info retrieved' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied - School Admin required' })
  async getMySchool(@GetUser() user: any) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux administrateurs d\'école');
    }

    const school = await this.schoolService.findOne(user.schoolAdmin.schoolId);
    return {
      success: true,
      data: school,
      message: 'School info retrieved successfully',
    };
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current school statistics (School Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'School statistics retrieved' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied - School Admin required' })
  async getMySchoolStats(@GetUser() user: any) {
    if (!user.schoolAdmin) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux administrateurs d\'école');
    }

    const schoolId = user.schoolAdmin.schoolId;
    // TODO: implement stats retrieval by school ID
    return {
      success: true,
      data: {
        schoolId,
        totalOffers: 0,
        openOffers: 0,
        totalApplications: 0,
        pendingApplications: 0,
        acceptedApplications: 0,
        rejectedApplications: 0,
      },
      message: 'School statistics retrieved successfully',
    };
  }
}
