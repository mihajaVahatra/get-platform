import {
  Controller,
  Get,
  Post,
  Put,
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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { LandingService } from './landing.service';
import {
  HeroConfigDto,
  StatsConfigDto,
  StepsConfigDto,
  ActorCardsConfigDto,
} from './dto/landing-config.dto';
import {
  CreateLandingNewsPostDto,
  UpdateLandingNewsPostDto,
} from './dto/landing-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  StorageService,
  ImageEntityType,
  ImageType,
} from '../../common/services/storage.service';

const IMAGE_FILTER = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Seules les images sont autorisées'), false);
    }
  },
};

@ApiTags('landing')
@Controller('landing')
export class LandingController {
  constructor(
    private readonly landingService: LandingService,
    private readonly storageService: StorageService,
  ) {}

  // ========== PUBLIC ROUTES ==========

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Get public landing page configuration' })
  async getConfig() {
    return this.landingService.getConfig();
  }

  @Public()
  @Get('news')
  @ApiOperation({ summary: 'Get published landing news posts' })
  @ApiQuery({ name: 'limit', required: false, example: 3 })
  async getPublishedNews(@Query('limit') limit = 3) {
    return this.landingService.getPublishedNews(Number(limit) || 3);
  }

  @Public()
  @Get('partners')
  @ApiOperation({ summary: 'Get unified partner list (schools + financial partners)' })
  async getPartners() {
    return this.landingService.getPartners();
  }

  // ========== ADMIN ROUTES (ADMIN_GET) ==========

  @Put('config/hero')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update landing hero content (Admin only)' })
  async updateHero(@Body() dto: HeroConfigDto) {
    return this.landingService.setHero(dto);
  }

  @Put('config/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update landing stats (Admin only)' })
  async updateStats(@Body() dto: StatsConfigDto) {
    return this.landingService.setStats(dto.items);
  }

  @Put('config/steps')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update landing steps (Admin only)' })
  async updateSteps(@Body() dto: StepsConfigDto) {
    return this.landingService.setSteps(dto.items);
  }

  @Put('config/actor-cards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update landing actor cards (Admin only)' })
  async updateActorCards(@Body() dto: ActorCardsConfigDto) {
    return this.landingService.setActorCards(dto.items);
  }

  @Get('news/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all landing news posts, incl. unpublished (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getAllNews(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.landingService.getAllNews(page, limit);
  }

  @Post('news')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a landing news post (Admin only)' })
  async createNews(@Body() dto: CreateLandingNewsPostDto) {
    return this.landingService.createNews(dto);
  }

  @Patch('news/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a landing news post (Admin only)' })
  async updateNews(@Param('id') id: string, @Body() dto: UpdateLandingNewsPostDto) {
    return this.landingService.updateNews(id, dto);
  }

  @Delete('news/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a landing news post (Admin only)' })
  async deleteNews(@Param('id') id: string) {
    return this.landingService.deleteNews(id);
  }

  @Post('news/:id/photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Attach a photo to a landing news post (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', IMAGE_FILTER))
  async uploadNewsPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier uploadé');
    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.LANDING_NEWS,
      entityId: id,
      type: ImageType.BANNER,
    });
    return this.landingService.setNewsPhoto(id, result.url);
  }
}
