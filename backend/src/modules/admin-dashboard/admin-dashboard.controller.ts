import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('admin-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
@ApiBearerAuth('access-token')
@Controller('admin/dashboard-summary')
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform-wide dashboard summary (Admin only)' })
  async getSummary() {
    return { success: true, data: await this.service.getSummary() };
  }
}
