import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) =>
          request?.headers?.cookie
            ?.split('; ')
            .find((cookie: string) => cookie.startsWith('access_token='))
            ?.split('=')[1],
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // Les jetons à usage unique (reset de mot de passe, challenge MFA) portent
    // un champ `type` et ne doivent jamais être acceptés comme jeton d'accès,
    // même s'ils sont signés avec le même secret et encore valides.
    if (payload?.type) {
      throw new UnauthorizedException('Jeton invalide pour cet usage');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      // select explicite plutôt que `include` : exclut délibérément
      // `password` (hash bcrypt) et `mfaSecret`/`refreshToken` de l'objet
      // qui devient `request.user` dans tous les contrôleurs — un futur
      // `return user` accidentel ne peut plus les exposer.
      select: {
        id: true,
        email: true,
        roleId: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        mfaEnabled: true,
        failedLoginAttempts: true,
        lastFailedLoginAt: true,
        gender: true,
        theme: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        sessionVersion: true,
        student: true,
        schoolAdmin: true, //Ajouté pour les admins école
        role: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou inactif');
    }

    // Révocation de session : un jeton signé avant la dernière déconnexion
    // porte une `sessionVersion` obsolète et doit être rejeté même s'il est
    // encore cryptographiquement valide et non expiré.
    if (payload.sessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException(
        'Session révoquée, veuillez vous reconnecter',
      );
    }

    //Retourne l'utilisateur complet (avec les relations)
    return {
      ...user,
      role: user.role?.name || 'STUDENT',
      studentId: user.student?.id,
      schoolAdminId: user.schoolAdmin?.id,
    };
  }
}
