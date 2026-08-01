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
import { FinancialPartnerService } from './financial-partner.service';
import { CreateFinancialPartnerDto } from './dto/create-financial-partner.dto';
import { UpdateFinancialPartnerDto } from './dto/update-financial-partner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('financial-partners')
@ApiBearerAuth()
@Controller('financial-partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
export class FinancialPartnerController {
  constructor(
    private readonly financialPartnerService: FinancialPartnerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List financial partners' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.financialPartnerService.findAll(
      Number(page) || 1,
      Number(limit) || 20,
      { type, search },
    );
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Financial partners retrieved successfully',
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a financial partner' })
  create(@Body() dto: CreateFinancialPartnerDto) {
    return this.financialPartnerService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a financial partner' })
  update(@Param('id') id: string, @Body() dto: UpdateFinancialPartnerDto) {
    return this.financialPartnerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a financial partner' })
  remove(@Param('id') id: string) {
    return this.financialPartnerService.delete(id);
  }
}
