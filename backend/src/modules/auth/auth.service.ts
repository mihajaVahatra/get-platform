import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa/mfa.service';
import { NotificationService } from '../notification/notification.service';
import {
  NotificationPriority,
  NotificationType,
} from '../notification/dto/send-notification.dto';

const MFA_CHALLENGE_EXPIRATION = '5m';

@Injectable()
export class AuthService {
  private MAX_LOGIN_ATTEMPTS = 5;
  private LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mfaService: MfaService,
    private notificationService: NotificationService,
  ) {}

  // ========== REGISTER ==========

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'STUDENT' },
    });

    if (!studentRole) {
      throw new Error("Rôle STUDENT introuvable. Exécutez d'abord le seed.");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        roleId: studentRole.id,
        student: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
          },
        },
      },
      include: {
        student: true,
        role: true,
      },
    });

    this.notifyN8n('student-created', 'student.created', user.id);

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role!.name,
      user.sessionVersion,
    );
    const userInfo = this.extractUserInfo(user);

    return {
      ...tokens,
      user: userInfo,
    };
  }

  // ========== LOGIN ==========

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        student: true,
        schoolAdmin: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.checkLoginAttempts(user.id);

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.resetLoginAttempts(user.id);

    if (user.mfaEnabled) {
      // Le mot de passe est valide mais le MFA est activé : on ne délivre
      // aucun jeton d'accès tant que le code TOTP n'est pas vérifié.
      const challengeToken = this.jwt.sign(
        { sub: user.id, type: 'mfa_challenge' },
        {
          expiresIn: MFA_CHALLENGE_EXPIRATION,
          secret: this.config.get('JWT_SECRET'),
        },
      );
      return { mfaRequired: true as const, challengeToken };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role!.name,
      user.sessionVersion,
    );
    const userInfo = this.extractUserInfo(user);

    return {
      mfaRequired: false as const,
      ...tokens,
      user: userInfo,
    };
  }

  // ========== MFA LOGIN (étape 2) ==========

  async completeMfaLogin(challengeToken: string, code: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(challengeToken, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Session MFA expirée, veuillez vous reconnecter',
      );
    }
    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException('Jeton invalide');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { student: true, schoolAdmin: true, role: true },
    });
    if (!user || !user.mfaEnabled) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const verified = await this.mfaService.verifyCode(user.id, code);
    if (!verified) {
      throw new BadRequestException('Code MFA invalide');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role!.name,
      user.sessionVersion,
    );
    const userInfo = this.extractUserInfo(user);

    return {
      ...tokens,
      user: userInfo,
    };
  }

  // ========== REFRESH TOKEN ==========
  // L'access token dure volontairement peu (15 min) : c'est le refresh token
  // (7 jours, cookie httpOnly séparé) qui doit permettre d'en obtenir un
  // nouveau silencieusement, sans forcer une reconnexion tant que la session
  // n'a pas été explicitement révoquée (logout / changement de sessionVersion).
  async refreshTokens(refreshToken: string) {
    let payload: {
      sub: string;
      sessionVersion: number;
      type?: string;
    };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Session expirée, veuillez vous reconnecter',
      );
    }

    // Comme pour l'access token dans JwtStrategy : rejette les jetons à
    // usage unique (reset, challenge MFA) même signés avec le bon secret.
    if (payload.type) {
      throw new UnauthorizedException('Jeton invalide pour cet usage');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { student: true, schoolAdmin: true, role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou inactif');
    }

    if (payload.sessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException(
        'Session révoquée, veuillez vous reconnecter',
      );
    }

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role!.name,
      user.sessionVersion,
    );
    const userInfo = this.extractUserInfo(user);

    return {
      ...tokens,
      user: userInfo,
    };
  }

  // ========== LOGOUT ==========

  async revokeSession(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }

  // ========== FORGOT PASSWORD ==========

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        message:
          'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
      };
    }

    const resetToken = this.jwt.sign(
      { sub: user.id, type: 'reset' },
      { expiresIn: '1h' },
    );

    // FRONTEND_URL peut contenir plusieurs origines séparées par des
    // virgules (voir main.ts, même convention pour la liste CORS) — la
    // première est l'origine canonique à utiliser dans un lien envoyé par
    // email.
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).split(',')[0];
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    // Envoi via le canal email de NotificationService (simulé en dev/QA,
    // voir HIGH-03 — même mécanisme que les autres emails transactionnels
    // de la plateforme). Ne jamais propager une erreur d'envoi au client :
    // le message reste générique pour ne pas révéler si le compte existe.
    try {
      await this.notificationService.send({
        userId: user.id,
        type: NotificationType.EMAIL,
        title: 'Réinitialisation de votre mot de passe GET',
        body: `Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur ce lien (valable 1h) pour choisir un nouveau mot de passe : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        priority: NotificationPriority.HIGH,
        data: { resetUrl },
      });
    } catch {
      // Échec d'envoi non bloquant pour la réponse HTTP — évite de révéler
      // l'existence du compte via un comportement différent en cas d'erreur.
    }

    return {
      message:
        'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwt.verify(token);

      if (payload.type !== 'reset') {
        throw new BadRequestException('Token invalide');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { password: hashedPassword },
      });

      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
      };
    } catch (error) {
      throw new BadRequestException('Token invalide ou expiré');
    }
  }

  // ========== MFA (activation/désactivation, déléguées à MfaService) ==========

  async enableMfa(userId: string) {
    return this.mfaService.generateSecret(userId);
  }

  async verifyMfa(userId: string, code: string) {
    return this.mfaService.verifyAndEnable(userId, code);
  }

  async disableMfa(userId: string, code: string) {
    return this.mfaService.disable(userId, code);
  }

  // ========== PRIVATE HELPERS ==========

  /**
   * Best-effort : notifie n8n d'un événement métier via webhook. N8N_WEBHOOK_BASE_URL
   * non défini = no-op silencieux (n8n non déployé, CI, prod avant décision
   * d'hébergement — voir docs/n8n/02-preparation-infrastructure.md). Ne doit
   * JAMAIS faire échouer l'appelant : intentionnellement non-awaited.
   */
  private notifyN8n(webhookPath: string, eventType: string, entityId: string): void {
    const baseUrl = this.config.get<string>('N8N_WEBHOOK_BASE_URL');
    if (!baseUrl) return;

    const payload = {
      eventId: randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      entityId,
      source: 'get-backend',
    };

    const secret = this.config.get<string>('N8N_WEBHOOK_SECRET');

    fetch(`${baseUrl}/webhook/${webhookPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-webhook-secret': secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    }).catch((err) => {
      console.error(`[n8n webhook] ${eventType} non délivré :`, err.message);
    });
  }

  private extractUserInfo(user: any) {
    const roleName = user.role?.name || 'STUDENT';

    let firstName = '';
    let lastName = '';

    if (user.student) {
      firstName = user.student.firstName || '';
      lastName = user.student.lastName || '';
    } else if (user.schoolAdmin) {
      firstName = user.email.split('@')[0] || 'School';
      lastName = 'Admin';
    } else {
      firstName = user.email.split('@')[0] || 'Utilisateur';
      lastName = '';
    }

    return {
      id: user.id,
      email: user.email,
      firstName,
      lastName,
      role: roleName,
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    sessionVersion: number,
  ) {
    // `sessionVersion` est vérifié à chaque requête par JwtStrategy : un
    // jeton signé avec une valeur qui ne correspond plus à celle en base
    // (incrémentée à la déconnexion) est rejeté. C'est le mécanisme de
    // révocation de session côté serveur pour des JWT autrement stateless.
    const payload = { sub: userId, email, role, sessionVersion };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRATION', '15m'),
      secret: this.config.get('JWT_SECRET'),
    });

    const refreshToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });

    return { accessToken, refreshToken };
  }

  // ========== LOGIN ATTEMPTS ==========

  private async checkLoginAttempts(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true, lastFailedLoginAt: true },
    });

    if (user && user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      if (user.lastFailedLoginAt) {
        const timeSinceLastAttempt =
          Date.now() - user.lastFailedLoginAt.getTime();
        if (timeSinceLastAttempt < this.LOCK_TIME) {
          throw new UnauthorizedException(
            'Trop de tentatives. Réessayez dans 15 minutes.',
          );
        }
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
      });
    }
  }

  private async incrementLoginAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: { increment: 1 },
        lastFailedLoginAt: new Date(),
      },
    });
  }

  private async resetLoginAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
    });
  }
}
