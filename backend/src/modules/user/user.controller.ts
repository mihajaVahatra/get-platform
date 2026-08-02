import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List all platform user accounts (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'roleName', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('roleName') roleName?: string,
    @Query('isActive') isActive?: string,
  ) {
    const result = await this.userService.findAll(page, limit, {
      search,
      roleName,
      isActive,
    });
    return { success: true, data: result.items, meta: result.meta };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a user account (Admin only)' })
  async setActive(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @GetUser('id') currentUserId: string,
  ) {
    const user = await this.userService.setActive(id, dto.isActive, currentUserId);
    return { success: true, data: user, message: 'Statut du compte mis à jour' };
  }
}
