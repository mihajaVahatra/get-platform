import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Patch,
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
  ApiBody,
} from '@nestjs/swagger';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OfferResponseDto } from './dto/offer-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';

@ApiTags('offers')
@Controller('offers')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all offers with filters' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'diploma', required: false })
  @ApiQuery({ name: 'minFees', required: false, type: Number })
  @ApiQuery({ name: 'maxFees', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isOpen', required: false, type: Boolean })
  @ApiQuery({ name: 'city', required: false })
  @ApiPaginatedResponse(OfferResponseDto)
  async getOffers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('schoolId') schoolId?: string,
    @Query('diploma') diploma?: string,
    @Query('minFees') minFees?: number,
    @Query('maxFees') maxFees?: number,
    @Query('search') search?: string,
    @Query('isOpen') isOpen?: boolean,
    @Query('city') city?: string,
  ) {
    const result = await this.offerService.findAll(page, limit, {
      schoolId,
      diploma,
      minFees,
      maxFees,
      search,
      isOpen,
      city,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Offers retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get offer details' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Offer details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Offer not found' })
  async getOffer(@Param('id') id: string) {
    const offer = await this.offerService.findOne(id);
    return {
      success: true,
      data: offer,
      message: 'Offer retrieved successfully',
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new offer' })
  @ApiBody({ type: CreateOfferDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Offer created' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async createOffer(
    @Body() dto: CreateOfferDto,
    @GetUser('id') userId: string,
  ) {
    const offer = await this.offerService.create(dto, userId);
    return {
      success: true,
      data: offer,
      message: 'Offer created successfully',
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiBody({ type: UpdateOfferDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Offer updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Offer not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async updateOffer(
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
    @GetUser('id') userId: string,
  ) {
    const offer = await this.offerService.update(id, dto, userId);
    return {
      success: true,
      data: offer,
      message: 'Offer updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Offer deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Offer not found' })
  async deleteOffer(@Param('id') id: string, @GetUser('id') userId: string) {
    await this.offerService.delete(id, userId);
    return {
      success: true,
      message: 'Offer deleted successfully',
    };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Open or close an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiBody({
    schema: { properties: { isOpen: { type: 'boolean', example: true } } },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Offer status updated' })
  async toggleOfferStatus(
    @Param('id') id: string,
    @Body('isOpen') isOpen: boolean,
    @GetUser('id') userId: string,
  ) {
    const offer = await this.offerService.toggleStatus(id, isOpen, userId);
    return {
      success: true,
      data: offer,
      message: `Offer ${isOpen ? 'opened' : 'closed'} successfully`,
    };
  }

  // Additional endpoint to get offers by school (maybe redundant with filters)
  @Public()
  @Get('school/:schoolId')
  @ApiOperation({ summary: 'Get offers for a specific school' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiQuery({ name: 'isOpen', required: false, type: Boolean })
  @ApiResponse({ status: HttpStatus.OK, description: 'Offers retrieved' })
  async getSchoolOffers(
    @Param('schoolId') schoolId: string,
    @Query('isOpen') isOpen?: boolean,
  ) {
    const offers = await this.offerService.getOffersBySchool(schoolId, isOpen);
    return {
      success: true,
      data: offers,
      message: 'School offers retrieved successfully',
    };
  }
}
