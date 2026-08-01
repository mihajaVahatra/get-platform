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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FinancialPartnerService } from './financial-partner.service';
import { CreateFinancialPartnerDto } from './dto/create-financial-partner.dto';
import { UpdateFinancialPartnerDto } from './dto/update-financial-partner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  StorageService,
  ImageEntityType,
  ImageType,
} from '../../common/services/storage.service';

@ApiTags('financial-partners')
@ApiBearerAuth()
@Controller('financial-partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GET')
export class FinancialPartnerController {
  constructor(
    private readonly financialPartnerService: FinancialPartnerService,
    private readonly storageService: StorageService,
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

  @Post(':id/logo')
  @ApiOperation({ summary: 'Upload a financial partner logo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Seules les images sont autorisées'),
            false,
          );
        }
      },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }
    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.FINANCIAL_PARTNER,
      entityId: id,
      type: ImageType.LOGO,
    });
    await this.financialPartnerService.updateLogo(id, result.url);
    return {
      success: true,
      data: { logoUrl: result.url },
      message: 'Logo mis à jour',
    };
  }
}
