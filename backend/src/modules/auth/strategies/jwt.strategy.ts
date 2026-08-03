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
      include: {
        student: true,
        schoolAdmin: true, //Ajouté pour les admins école
        role: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou inactif');
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
