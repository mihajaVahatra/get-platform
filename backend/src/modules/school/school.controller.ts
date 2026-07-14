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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new school (Admin only)' })
  @ApiBody({ type: CreateSchoolDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'School created' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied - Admin required' })
  async createSchool(@Body() dto: CreateSchoolDto, @GetUser('id') userId: string) {
    const school = await this.schoolService.create(dto, userId);
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
    @GetUser('id') userId: string,
  ) {
    const school = await this.schoolService.update(id, dto, userId);
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
  async deleteSchool(@Param('id') id: string, @GetUser('id') userId: string) {
    await this.schoolService.delete(id, userId);
    return {
      success: true,
      message: 'School deleted successfully',
    };
  }
}
