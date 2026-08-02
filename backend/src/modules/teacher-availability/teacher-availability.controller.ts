import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherAvailabilityService } from './teacher-availability.service';
import { DeclareUnavailabilityDto } from './dto/teacher-availability.dto';
import { SetTravelBufferDto } from './dto/teacher-travel-buffer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('teacher-availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Controller('teacher/availability')
@Roles('TEACHER')
export class TeacherAvailabilityController {
  constructor(private readonly service: TeacherAvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'List my declared unavailability windows' })
  async list(@GetUser('id') userId: string) {
    const teacher = await this.service.resolveTeacherByUserId(userId);
    return { success: true, data: await this.service.listMyUnavailability(teacher.id) };
  }

  @Post()
  @ApiOperation({ summary: 'Declare an unavailability window (recurring or one-off)' })
  async create(@GetUser('id') userId: string, @Body() dto: DeclareUnavailabilityDto) {
    const teacher = await this.service.resolveTeacherByUserId(userId);
    return { success: true, data: await this.service.declareUnavailability(teacher.id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a declared unavailability window' })
  async remove(@GetUser('id') userId: string, @Param('id') id: string) {
    const teacher = await this.service.resolveTeacherByUserId(userId);
    await this.service.deleteUnavailability(teacher.id, id);
    return { success: true, message: 'Indisponibilité supprimée' };
  }
}

@ApiTags('teacher-availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Controller('teacher/travel-buffers')
@Roles('TEACHER')
export class TeacherTravelBufferController {
  constructor(private readonly service: TeacherAvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'List my declared travel buffers between schools' })
  async list(@GetUser('id') userId: string) {
    const teacher = await this.service.resolveTeacherByUserId(userId);
    return { success: true, data: await this.service.listMyTravelBuffers(teacher.id) };
  }

  @Post()
  @ApiOperation({ summary: 'Declare a minimum travel time between two of my schools' })
  async create(@GetUser('id') userId: string, @Body() dto: SetTravelBufferDto) {
    const teacher = await this.service.resolveTeacherByUserId(userId);
    return { success: true, data: await this.service.setTravelBuffer(teacher.id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a declared travel buffer' })
  async remove(@GetUser('id') userId: string, @Param('id') id: string) {
    const teacher = await this.service.resolveTeacherByUserId(userId);
    await this.service.deleteTravelBuffer(teacher.id, id);
    return { success: true, message: 'Temps de trajet supprimé' };
  }
}

@ApiTags('teacher-availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Controller('teachers')
@Roles('ADMIN_GET')
export class TeacherConflictsController {
  constructor(private readonly service: TeacherAvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Search teachers by name/email (Admin only)' })
  async search(@Query('search') search?: string) {
    return { success: true, data: await this.service.searchTeachers(search) };
  }

  @Get(':id/conflicts')
  @ApiOperation({ summary: 'Get travel-buffer conflict report for a teacher (Admin only)' })
  async conflicts(@Param('id') id: string) {
    return { success: true, data: await this.service.getConflictReport(id) };
  }
}
