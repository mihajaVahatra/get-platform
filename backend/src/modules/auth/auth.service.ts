import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa/mfa.service';

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

    const tokens = this.generateTokens(user.id, user.email, user.role!.name);
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
        { expiresIn: MFA_CHALLENGE_EXPIRATION, secret: this.config.get('JWT_SECRET') },
      );
      return { mfaRequired: true as const, challengeToken };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(user.id, user.email, user.role!.name);
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

    const tokens = this.generateTokens(user.id, user.email, user.role!.name);
    const userInfo = this.extractUserInfo(user);

    return {
      ...tokens,
      user: userInfo,
    };
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

    // Le token doit être envoyé par un fournisseur d'e-mail. Ne jamais le logger.
    void resetToken;

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

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

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
