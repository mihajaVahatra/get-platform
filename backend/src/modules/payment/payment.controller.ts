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

/**
 * Contrôleur des paiements de frais de scolarité : initiation, webhook de
 * confirmation du fournisseur de paiement, consultation, historique, reçu
 * PDF et statistiques admin. La plupart des routes exigent un rôle STUDENT
 * (paiement de sa propre candidature) ou ADMIN_GET (vue plateforme) ; le
 * webhook est public mais protégé par signature HMAC (voir PaymentService).
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Démarre un paiement pour une candidature acceptée de l'étudiant
   * authentifié. Le montant n'est jamais fourni par le client : il est
   * dérivé de l'offre liée à la candidature (voir PaymentService.initiatePayment).
   * @throws NotFoundException si aucun profil étudiant n'existe pour l'utilisateur.
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
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

  /**
   * Statistiques agrégées des paiements (total, montants, répartition par
   * statut/méthode), filtrables par plage de dates. Réservé aux admins.
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Payment statistics (Admin only)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getStats(@Query('from') from?: string, @Query('to') to?: string) {
    const stats = await this.paymentService.getStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return { success: true, data: stats };
  }

  /**
   * Liste paginée de tous les paiements de la plateforme (toutes écoles/
   * étudiants confondus), filtrable par statut et plage de dates. Réservé
   * aux admins.
   */
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all payments across the platform (Admin only)',
  })
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

  /**
   * Détail d'un paiement. L'accès est vérifié en service (PaymentService.getPayment) :
   * un STUDENT ne peut consulter que ses propres paiements, ADMIN_GET peut
   * tout consulter.
   * @throws NotFoundException si le paiement n'existe pas.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ADMIN_GET')
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

  /** Historique paginé des paiements de l'étudiant authentifié. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
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

  /**
   * Webhook appelé par le fournisseur de paiement pour confirmer/rejeter un
   * paiement. Marqué `@Public()` (pas de JWT possible côté fournisseur
   * externe) mais protégé par une signature HMAC vérifiée en service
   * (PaymentService.assertValidWebhookSignature) — jamais faire confiance
   * à ce endpoint sans cette vérification.
   */
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

  /**
   * Webhook natif Stripe (Checkout Sessions) : signature vérifiée via
   * `Stripe-Signature` (schéma propre à Stripe, distinct du HMAC maison de
   * `/webhook` ci-dessus) puis déléguée à la même logique de réconciliation
   * — voir `PaymentService.handleStripeWebhook`. `@Public()` pour la même
   * raison que `/webhook` : appelé serveur à serveur par Stripe, aucun JWT
   * possible.
   */
  @Public()
  @Post('webhook/stripe')
  @ApiOperation({ summary: 'Native Stripe webhook for payment confirmation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const result = await this.paymentService.handleStripeWebhook(
      req.rawBody,
      signature,
    );
    return { success: true, data: result };
  }

  /**
   * Télécharge le reçu PDF d'un paiement (même contrôle d'accès que
   * getPayment, délégué au service). Génère un PDF minimal à la volée.
   */
  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ADMIN_GET')
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

  /**
   * Ouvre un compte bancaire pour l'étudiant auprès d'une banque
   * partenaire. Implémentation actuelle simulée côté service (numéro de
   * compte généré localement, aucun appel à une vraie banque) — voir
   * PaymentService.openBankAccount.
   */
  @Post('bank-account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
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
