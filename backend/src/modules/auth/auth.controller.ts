import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { MfaExempt } from '../../common/decorators/mfa-exempt.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * Contrôleur d'authentification : inscription (avec vérification d'email),
 * connexion (avec étape MFA optionnelle), rafraîchissement de session,
 * déconnexion, réinitialisation de mot de passe et gestion du MFA (TOTP).
 * Les tokens d'accès/rafraîchissement sont transmis via des cookies
 * httpOnly plutôt que dans le corps de la réponse (voir setSessionCookies).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Pose les cookies de session (access + refresh token) sur la réponse.
   * Toujours httpOnly (inaccessibles en JS côté client, protection XSS).
   * `sameSite` vaut 'lax' par défaut, ou 'none' si CROSS_SITE_COOKIES=true
   * (déploiements avec frontend/backend sur des domaines différents) — voir
   * le commentaire ci-dessous pour le détail de cet arbitrage sécurité.
   */
  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const secure = this.config.get('NODE_ENV') === 'production';
    // 'lax' est le réglage sûr par défaut (protection CSRF) et suffit quand
    // frontend/backend partagent le même domaine. Certains déploiements
    // (ex. QA avec frontend sur Vercel et backend sur Render, deux domaines
    // distincts) ont besoin de 'none' pour que le navigateur renvoie le
    // cookie sur les appels cross-site — d'où cet opt-in explicite plutôt
    // que d'affaiblir la protection par défaut pour tout le monde.
    const crossSite = this.config.get('CROSS_SITE_COOKIES') === 'true';
    const sameSite = crossSite ? 'none' : 'lax';
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: secure || crossSite,
      sameSite,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: secure || crossSite,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  // ========== REGISTER ==========
  // Ne crée pas le compte immédiatement : place l'inscription en attente et
  // envoie un email de vérification (lien + code). Le compte n'existe qu'une
  // fois la vérification effectuée via /auth/verify-email(/code).
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start registration, sends a verification email' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  /**
   * Démarre une inscription étudiante. Public, limité à 5 requêtes/min/IP.
   * Ne crée pas le compte : place la demande en attente et envoie un email
   * de vérification (voir AuthService.register).
   * @param dto email, mot de passe, nom/prénom, téléphone.
   * @returns confirmation que l'email de vérification a été envoyé.
   * @throws ConflictException si l'email est déjà utilisé par un compte existant.
   */
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ========== VÉRIFICATION EMAIL (lien) ==========
  @Public()
  @Post('verify-email')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify email via link token, creates the account' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Account created and logged in' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  /**
   * Finalise l'inscription via le token JWT reçu par lien dans l'email de
   * vérification. Crée réellement le compte User/Student et connecte
   * l'utilisateur (pose les cookies de session).
   * @param dto token de vérification signé (type `email_verify`).
   * @returns les infos publiques de l'utilisateur nouvellement créé.
   * @throws BadRequestException si le token est invalide/expiré, ou si
   * l'email a déjà été vérifié par ailleurs (double clic, code+lien concurrents).
   */
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.verifyEmailByToken(dto.token);
    this.setSessionCookies(response, accessToken, refreshToken);
    return { user };
  }

  // ========== VÉRIFICATION EMAIL (code) ==========
  @Public()
  @Post('verify-email/code')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify email via 6-digit code, creates the account',
  })
  @ApiBody({ type: VerifyEmailCodeDto })
  @ApiResponse({ status: 200, description: 'Account created and logged in' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  /**
   * Finalise l'inscription via le code à 6 chiffres envoyé par email
   * (alternative au lien, pratique si le lien ne fonctionne pas). Crée le
   * compte et connecte l'utilisateur.
   * @param dto email + code de vérification.
   * @returns les infos publiques de l'utilisateur nouvellement créé.
   * @throws BadRequestException si aucune inscription en attente n'existe,
   * si le code a expiré, trop de tentatives ont été faites, ou le code est invalide.
   */
  async verifyEmailCode(
    @Body() dto: VerifyEmailCodeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.verifyEmailByCode(dto.email, dto.code);
    this.setSessionCookies(response, accessToken, refreshToken);
    return { user };
  }

  // ========== RENVOI DU CODE / LIEN DE VÉRIFICATION ==========
  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resend the email verification link/code' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Verification email resent if pending',
  })
  /**
   * Renvoie un nouveau code/lien de vérification pour une inscription en
   * attente. Limité à 3 requêtes/min pour limiter l'abus d'envoi d'emails.
   * @param dto email de l'inscription en attente.
   * @returns un message générique, que l'inscription existe ou non
   * (évite de révéler si un email est déjà en cours d'inscription).
   */
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  // ========== LOGIN ==========
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  /**
   * Authentifie un utilisateur par email/mot de passe. Public, limité à
   * 5 requêtes/min/IP (protection brute-force en complément du verrouillage
   * de compte côté service).
   * @param dto email + mot de passe.
   * @returns soit les infos utilisateur (cookies de session posés), soit
   * `{ mfaRequired: true, challengeToken }` si le MFA est activé pour ce
   * compte — aucun cookie n'est posé dans ce dernier cas.
   * @throws UnauthorizedException si les identifiants sont invalides, si le
   * compte est verrouillé (5 échecs, 15 min), ou si l'email n'est pas encore vérifié.
   */
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    if (result.mfaRequired) {
      // Aucun cookie de session tant que le code MFA n'est pas vérifié.
      return { mfaRequired: true, challengeToken: result.challengeToken };
    }
    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  // ========== LOGIN — étape 2 (vérification MFA) ==========
  @Public()
  @Post('mfa/login-verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA code to complete login' })
  @ApiBody({ type: MfaLoginVerifyDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired challenge' })
  /**
   * Complète la connexion pour un compte avec MFA activé, en validant le
   * code TOTP contre le challenge émis par /auth/login.
   * @param dto challengeToken (5 min de validité) + code TOTP à 6 chiffres.
   * @returns les infos utilisateur, cookies de session posés.
   * @throws UnauthorizedException si le challenge est expiré/invalide.
   * @throws BadRequestException si le code TOTP est invalide.
   */
  async loginMfaVerify(
    @Body() dto: MfaLoginVerifyDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.completeMfaLogin(dto.challengeToken, dto.code);
    this.setSessionCookies(response, accessToken, refreshToken);
    return { user };
  }

  // ========== REFRESH ==========
  // L'access token ne dure que 15 min (voir setSessionCookies) : sans cet
  // endpoint, toute session active finit par un 401 sur le premier appel API
  // suivant l'expiration, avec redirection immédiate vers /auth/login côté
  // frontend (voir api-client.ts) — même en cours d'utilisation active. Le
  // refresh token (7 jours) permet d'obtenir un nouvel access token
  // silencieusement tant que la session n'a pas été révoquée (logout).
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh the access token using the refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Access token refreshed' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired refresh token' })
  /**
   * Émet un nouveau couple access/refresh token à partir du refresh token
   * présent dans le cookie `refresh_token` (lu manuellement depuis l'en-tête
   * `Cookie`, pas via un décorateur, pour rester indépendant du parsing
   * de cookies configuré globalement). Public par nécessité : c'est cet
   * endpoint qui redonne un access token une fois celui-ci expiré.
   * @returns les infos utilisateur, nouveaux cookies de session posés.
   * @throws UnauthorizedException si le cookie refresh_token est absent,
   * invalide, expiré, ou si la session a été révoquée (sessionVersion).
   */
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.headers.cookie
      ?.split('; ')
      .find((cookie) => cookie.startsWith('refresh_token='))
      ?.split('=')[1];
    if (!refreshToken) {
      throw new UnauthorizedException('Aucune session à rafraîchir');
    }
    const { accessToken, refreshToken: newRefreshToken, user } =
      await this.authService.refreshTokens(refreshToken);
    this.setSessionCookies(response, accessToken, newRefreshToken);
    return { user };
  }

  /**
   * Retourne le profil de l'utilisateur actuellement authentifié, à partir
   * du `request.user` peuplé par JwtStrategy (aucun accès direct à la base
   * ici). Protégé par JwtAuthGuard : nécessite un access token valide.
   * @MfaExempt : un compte à rôle privilégié pas encore enrôlé au MFA doit
   * pouvoir lire son propre statut `mfaEnabled` (voir MfaEnforcedGuard) —
   * sinon le frontend n'aurait aucun moyen de savoir qu'il doit rediriger
   * vers l'enrôlement.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @MfaExempt()
  @ApiBearerAuth('access-token')
  async me(@GetUser() user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        gender: user.gender,
        firstName: user.student?.firstName || user.email.split('@')[0],
        lastName: user.student?.lastName || '',
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  /**
   * Déconnecte l'utilisateur : révoque la session (incrémente
   * sessionVersion, invalidant tout access/refresh token existant) puis
   * efface les cookies. Voir le commentaire ci-dessous pour la raison de
   * @Public() sur cet endpoint.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Reste @Public() (pas de JwtAuthGuard) pour que la déconnexion
    // fonctionne même avec un access token déjà expiré — sinon les cookies
    // ne seraient jamais nettoyés dans ce cas. Le décodage ci-dessous est
    // donc en best-effort (`ignoreExpiration`), jamais bloquant.
    const cookieToken = request.headers.cookie
      ?.split('; ')
      .find((cookie) => cookie.startsWith('access_token='))
      ?.split('=')[1];
    if (cookieToken) {
      try {
        const payload = this.jwt.verify(cookieToken, {
          secret: this.config.get('JWT_SECRET'),
          ignoreExpiration: true,
        });
        if (payload?.sub && !payload?.type) {
          await this.authService.revokeSession(payload.sub);
        }
      } catch {
        // Jeton illisible/signature invalide : rien à révoquer, on continue.
      }
    }
    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/' });
  }

  // ========== FORGOT PASSWORD ==========
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Reset email sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  /**
   * Déclenche l'envoi d'un email de réinitialisation de mot de passe.
   * Limité à 3 requêtes/min pour limiter l'énumération/spam d'emails.
   * @returns toujours un message générique, que le compte existe ou non
   * (ne révèle jamais l'existence d'un email en base).
   */
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  // ========== RESET PASSWORD ==========
  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({
    schema: {
      properties: {
        token: { type: 'string' },
        newPassword: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid token or password' })
  /**
   * Applique un nouveau mot de passe à partir du token reçu par email
   * (valable 1h, type `reset`).
   * @throws BadRequestException si le token est invalide, expiré, ou d'un
   * autre type que `reset`.
   */
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ========== MFA ==========
  // Réservé aux rôles à privilèges élevés (admins, ministère) : ce sont les
  // comptes les plus sensibles de la plateforme, d'où le MFA en option
  // renforcée plutôt qu'obligatoire pour tous les utilisateurs.

  /**
   * Démarre l'activation du MFA : génère un secret TOTP et un QR code à
   * scanner dans une app d'authentification. Le MFA n'est pas encore actif
   * à ce stade (voir verifyMfa). Si le MFA est déjà activé sur le compte, un
   * `code` TOTP courant valide est exigé pour ré-enrôler (empêche un tiers
   * ayant seulement le cookie de session de désactiver le MFA en appelant
   * cet endpoint, ex. via CSRF — voir setSessionCookies).
   * @throws BadRequestException si le MFA est déjà actif sans code valide fourni.
   * @returns `{ qrCode, secret }` (secret en clair pour saisie manuelle).
   */
  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @MfaExempt()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enable MFA for admin' })
  @ApiBody({
    required: false,
    schema: {
      properties: {
        code: {
          type: 'string',
          example: '123456',
          description: 'Code TOTP courant, requis uniquement pour ré-enrôler un MFA déjà actif',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'MFA QR code generated' })
  async enableMfa(
    @GetUser('id') userId: string,
    @Body('code') code?: string,
  ) {
    return this.authService.enableMfa(userId, code);
  }

  /**
   * Confirme la possession du secret TOTP généré par mfa/enable et active
   * effectivement le MFA sur le compte. Limité à 5 requêtes/min.
   * @throws BadRequestException si aucun secret n'a été généré ou si le code est invalide.
   */
  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @MfaExempt()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify and enable MFA' })
  @ApiBody({
    schema: { properties: { code: { type: 'string', example: '123456' } } },
  })
  async verifyMfa(@GetUser('id') userId: string, @Body('code') code: string) {
    return this.authService.verifyMfa(userId, code);
  }

  /**
   * Désactive le MFA sur le compte, après re-vérification du code TOTP
   * courant (empêche la désactivation par un tiers ayant seulement le
   * cookie de session, sans le secret TOTP). Limité à 5 requêtes/min.
   * @throws BadRequestException si le code TOTP est invalide.
   */
  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiBody({
    schema: { properties: { code: { type: 'string', example: '123456' } } },
  })
  async disableMfa(@GetUser('id') userId: string, @Body('code') code: string) {
    return this.authService.disableMfa(userId, code);
  }
}
