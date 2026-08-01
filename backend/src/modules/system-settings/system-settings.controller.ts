import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform general settings (Admin only)' })
  async get() {
    return { success: true, data: await this.service.getSettings() };
  }

  @Put()
  @ApiOperation({ summary: 'Update platform general settings (Admin only)' })
  async update(@Body() dto: UpdatePlatformSettingsDto) {
    return {
      success: true,
      data: await this.service.updateSettings(dto),
      message: 'Paramètres mis à jour',
    };
  }
}
