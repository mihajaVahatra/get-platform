import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CompetitionService } from './competition.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('competitions')
@ApiBearerAuth()
@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get()
  @ApiOperation({ summary: 'List competitions' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.competitionService.findAll(
      Number(page) || 1,
      Number(limit) || 20,
      { schoolId, status, search },
    );
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Competitions retrieved successfully',
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a competition' })
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitionService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a competition' })
  update(@Param('id') id: string, @Body() dto: UpdateCompetitionDto) {
    return this.competitionService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a competition' })
  remove(@Param('id') id: string) {
    return this.competitionService.delete(id);
  }
}
