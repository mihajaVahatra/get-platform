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
import { FeeBracketService } from './fee-bracket.service';
import {
  CreateFeeBracketDto,
  UpdateFeeBracketDto,
} from './dto/fee-bracket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('fee-brackets')
@Controller('fee-brackets')
export class FeeBracketController {
  constructor(private readonly feeBracketService: FeeBracketService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List fee brackets (used to populate the offers fee filter)',
  })
  async findAll() {
    return { success: true, data: await this.feeBracketService.findAll() };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a fee bracket (Admin only)' })
  async create(@Body() dto: CreateFeeBracketDto) {
    return { success: true, data: await this.feeBracketService.create(dto) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a fee bracket (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateFeeBracketDto) {
    return {
      success: true,
      data: await this.feeBracketService.update(id, dto),
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a fee bracket (Admin only)' })
  async remove(@Param('id') id: string) {
    await this.feeBracketService.delete(id);
    return { success: true, message: 'Tranche de frais supprimée' };
  }
}
