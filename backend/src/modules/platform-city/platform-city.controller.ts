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
import { PlatformCityService } from './platform-city.service';
import {
  CreatePlatformCityDto,
  UpdatePlatformCityDto,
} from './dto/platform-city.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('platform-cities')
@Controller('platform-cities')
export class PlatformCityController {
  constructor(private readonly platformCityService: PlatformCityService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List platform cities (used to populate city pickers)',
  })
  async findAll() {
    return { success: true, data: await this.platformCityService.findAll() };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a platform city (Admin only)' })
  async create(@Body() dto: CreatePlatformCityDto) {
    return { success: true, data: await this.platformCityService.create(dto) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a platform city (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdatePlatformCityDto) {
    return {
      success: true,
      data: await this.platformCityService.update(id, dto),
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a platform city (Admin only)' })
  async remove(@Param('id') id: string) {
    await this.platformCityService.delete(id);
    return { success: true, message: 'Ville supprimée' };
  }
}
