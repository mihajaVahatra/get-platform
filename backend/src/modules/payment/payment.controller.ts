import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpStatus,
  UseGuards,
  StreamableFile,
  NotFoundException,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate a payment' })
  @ApiBody({ type: InitiatePaymentDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Payment initiated' })
  async initiatePayment(
    @GetUser('id') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student not found');
    const result = await this.paymentService.initiatePayment(student.id, dto);
    return { success: true, data: result };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MINISTRY', 'ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Payment statistics (Admin/Ministry only)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getStats(@Query('from') from?: string, @Query('to') to?: string) {
    const stats = await this.paymentService.getStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return { success: true, data: stats };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all payments across the platform (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async findAllAdmin(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.paymentService.findAllAdmin(page, limit, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return { success: true, data: result.items, meta: result.meta };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payment status' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment details' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment not found',
  })
  async getPayment(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
  ) {
    const payment = await this.paymentService.getPayment(id, userId, role);
    return { success: true, data: payment };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payment history' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getHistory(
    @GetUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student not found');
    const result = await this.paymentService.getHistory(
      student.id,
      page,
      limit,
    );
    return { success: true, data: result.items, meta: result.meta };
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook for payment confirmation' })
  @ApiBody({ type: PaymentWebhookDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed' })
  async handleWebhook(
    @Body() dto: PaymentWebhookDto,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    const result = await this.paymentService.handleWebhook(
      dto,
      req.rawBody,
      signature,
    );
    return { success: true, data: result };
  }

  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Download payment receipt' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Receipt PDF' })
  async getReceipt(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
  ) {
    const buffer = await this.paymentService.generateReceipt(id, userId, role);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="receipt-${id}.pdf"`,
    });
  }

  @Post('bank-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Open a bank account for student' })
  @ApiBody({
    schema: { properties: { bankId: { type: 'string', example: 'bank-123' } } },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bank account opened',
  })
  async openBankAccount(
    @GetUser('id') userId: string,
    @Body('bankId') bankId: string,
  ) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student not found');
    const result = await this.paymentService.openBankAccount(
      student.id,
      bankId,
    );
    return { success: true, data: result };
  }
}
