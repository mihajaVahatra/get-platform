import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private MAX_LOGIN_ATTEMPTS = 5;
  private LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
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
      throw new Error('Rôle STUDENT introuvable. Exécutez d\'abord le seed.');
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

    // Vérifier les tentatives de connexion
    await this.checkLoginAttempts(user.id);

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Réinitialiser les tentatives après succès
    await this.resetLoginAttempts(user.id);

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

  // ========== MFA METHODS ==========

  async enableMfa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `GET (${userId})`,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret.base32,
        mfaEnabled: false,
      },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      qrCode,
      secret: secret.base32,
    };
  }

  async verifyMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not configured');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      throw new BadRequestException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { success: true };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not configured');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      throw new BadRequestException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaEnabled: false,
      },
    });

    return { success: true };
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
      //Vérifier si lastFailedLoginAt existe avant d'appeler getTime()
      if (user.lastFailedLoginAt) {
        const timeSinceLastAttempt = Date.now() - user.lastFailedLoginAt.getTime();
        if (timeSinceLastAttempt < this.LOCK_TIME) {
          throw new UnauthorizedException(
            'Trop de tentatives. Réessayez dans 15 minutes.'
          );
        }
      }
      // Réinitialiser après 15 minutes (ou si lastFailedLoginAt est null)
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