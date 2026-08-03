import {
  Controller,
  Get,
  Query,
  Param,
  ParseEnumPipe,
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
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditLogDto, AuditResource } from './dto/audit-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET', 'MINISTRY')
@ApiBearerAuth('access-token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ============================================================
  // 1. LISTE DES LOGS (avec filtres)
  // ============================================================

  @Get()
  @ApiOperation({
    summary: 'Get audit logs with filters (Admin/Ministry only)',
  })
  @ApiPaginatedResponse(AuditLogDto)
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved' })
  async getLogs(@Query() query: AuditQueryDto) {
    const result = await this.auditService.getLogs(query);
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Audit logs retrieved successfully',
    };
  }

  // ============================================================
  // 2. LOGS POUR UNE RESSOURCE SPÉCIFIQUE
  // ============================================================

  @Get('resource/:resource/:id')
  @ApiOperation({ summary: 'Get audit logs for a specific resource' })
  @ApiParam({
    name: 'resource',
    enum: ['user', 'student', 'school', 'offer', 'application', 'payment'],
  })
  @ApiParam({ name: 'id', description: 'Resource ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resource audit logs retrieved',
  })
  async getLogsForResource(
    @Param('resource', new ParseEnumPipe(AuditResource)) resource: AuditResource,
    @Param('id') resourceId: string,
  ) {
    const logs = await this.auditService.getLogsForResource(
      resource,
      resourceId,
    );
    return {
      success: true,
      data: logs,
      message: 'Resource audit logs retrieved successfully',
    };
  }

  // ============================================================
  // 3. LOGS POUR UN UTILISATEUR
  // ============================================================

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User audit logs retrieved',
  })
  async getLogsForUser(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.auditService.getLogsForUser(userId, page, limit);
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'User audit logs retrieved successfully',
    };
  }

  // ============================================================
  // 4. STATISTIQUES DES LOGS
  // ============================================================

  @Get('stats')
  @ApiOperation({ summary: 'Get audit statistics (Admin/Ministry only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit statistics retrieved',
  })
  async getStats() {
    const stats = await this.auditService.getStats();
    return {
      success: true,
      data: stats,
      message: 'Audit statistics retrieved successfully',
    };
  }

  // ============================================================
  // 5. MES PROPRES LOGS
  // ============================================================

  @Get('me')
  @ApiOperation({ summary: 'Get my own audit logs' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'My audit logs retrieved',
  })
  async getMyLogs(
    @GetUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.auditService.getLogsForUser(userId, page, limit);
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'My audit logs retrieved successfully',
    };
  }
}
