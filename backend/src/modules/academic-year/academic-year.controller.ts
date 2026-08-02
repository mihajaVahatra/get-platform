import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('academic-years')
@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List academic years (used by school admins to plan schedules)' })
  async findAll() {
    return { success: true, data: await this.academicYearService.findAll() };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an academic year (Admin only)' })
  async create(@Body() dto: CreateAcademicYearDto) {
    return { success: true, data: await this.academicYearService.create(dto) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an academic year (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAcademicYearDto) {
    return { success: true, data: await this.academicYearService.update(id, dto) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete an unused academic year (Admin only)' })
  async remove(@Param('id') id: string) {
    await this.academicYearService.delete(id);
    return { success: true, message: 'Année scolaire supprimée' };
  }
}
