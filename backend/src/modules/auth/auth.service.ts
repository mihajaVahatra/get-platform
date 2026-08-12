import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomInt, randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa/mfa.service';
import { NotificationService } from '../notification/notification.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CURRENT_TERMS_VERSION } from './terms.constant';

const MFA_CHALLENGE_EXPIRATION = '5m';
const EMAIL_VERIFICATION_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24h
const EMAIL_VERIFICATION_JWT_EXPIRATION = '24h';
const MAX_VERIFICATION_CODE_ATTEMPTS = 8;
const RESET_TOKEN_EXPIRATION_MS = 60 * 60 * 1000; // 1h
// Hash bcrypt d'une valeur aléatoire fixe, jamais un mot de passe réel : sert
// uniquement à faire exécuter un bcrypt.compare de coût constant quand aucun
// hash réel n'existe (email totalement inconnu), pour que login() ne prenne
// pas un chemin visiblement plus rapide dans ce cas — voir login().
const DUMMY_PASSWORD_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8g2xnfj/RcM7lz3l0i5U7YQ29OaG3.';

/**
 * Service central d'authentification : inscription avec vérification
 * d'email, connexion (mot de passe + MFA optionnel), gestion des tokens
 * JWT (access/refresh), révocation de session, réinitialisation de mot de
 * passe et verrouillage de compte après échecs de connexion répétés.
 */
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
    private encryption: EncryptionService,
  ) {}

  // ========== REGISTER ==========

  /**
   * N'écrit aucun User tant que l'email n'est pas vérifié : la demande
   * d'inscription est mise en attente (PendingRegistration) et un email
   * envoyé avec un lien + un code de secours. Le compte réel n'est créé
   * qu'à la vérification (voir completeEmailVerification). Un email déjà
   * utilisé par une inscription en attente peut se réinscrire (upsert) —
   * ça redonne simplement un nouveau code, pratique si le premier a expiré.
   */
  async register(dto: RegisterDto) {
    // Refuse plutôt que d'enregistrer une acceptation qui ne correspond pas
    // au texte réellement affiché par le frontend au moment du clic (page
    // obsolète en cache, appel direct à l'API en contournant l'UI...).
    if (dto.acceptedTermsVersion !== CURRENT_TERMS_VERSION) {
      throw new BadRequestException(
        'La version des CGU a changé : merci de recharger la page et de les accepter à nouveau.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const code = this.generateVerificationCode();
    const codeHash = this.sha256Hex(code);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRATION_MS);
    // Chiffré dès la mise en attente : le téléphone est recopié tel quel
    // dans Student.phone à la vérification (voir completeEmailVerification),
    // donc c'est ici ou jamais qu'il faut le chiffrer.
    const encryptedPhone = this.encryption.encrypt(dto.phone);
    const acceptedTermsAt = new Date();

    const pending = await this.prisma.pendingRegistration.upsert({
      where: { email: dto.email },
      create: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: encryptedPhone,
        codeHash,
        expiresAt,
        acceptedTermsVersion: dto.acceptedTermsVersion,
        acceptedTermsAt,
      },
      update: {
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: encryptedPhone,
        codeHash,
        codeAttempts: 0,
        expiresAt,
        acceptedTermsVersion: dto.acceptedTermsVersion,
        acceptedTermsAt,
      },
    });

    await this.sendVerificationEmail(
      pending.id,
      pending.email,
      pending.firstName,
      code,
    );

    return { pendingVerification: true as const, email: pending.email };
  }

  // ========== VÉRIFICATION EMAIL ==========

  /**
   * Vérifie un email via le JWT `email_verify` reçu par lien. Délègue la
   * création du compte à completeEmailVerification.
   * @throws BadRequestException si le token est invalide/expiré ou n'est
   * pas du bon type.
   */
  async verifyEmailByToken(token: string) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify<{ sub: string; type: string }>(token);
    } catch {
      throw new BadRequestException('Lien de vérification invalide ou expiré');
    }
    if (payload?.type !== 'email_verify') {
      throw new BadRequestException('Lien de vérification invalide');
    }
    return this.completeEmailVerification(payload.sub);
  }

  /**
   * Vérifie un email via le code à 6 chiffres (comparé par hash SHA-256,
   * jamais en clair). Incrémente le compteur de tentatives à chaque échec
   * pour limiter le brute-force du code.
   * @throws BadRequestException si aucune inscription en attente n'existe,
   * si elle a expiré, si le nombre max de tentatives est atteint, ou si le
   * code ne correspond pas.
   */
  async verifyEmailByCode(email: string, code: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });
    if (!pending) {
      throw new BadRequestException(
        'Aucune inscription en attente pour cet email',
      );
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration
        .delete({ where: { id: pending.id } })
        .catch(() => undefined);
      throw new BadRequestException(
        'Ce code a expiré, redemande un nouveau code.',
      );
    }
    if (pending.codeAttempts >= MAX_VERIFICATION_CODE_ATTEMPTS) {
      throw new BadRequestException(
        'Trop de tentatives, redemande un nouveau code.',
      );
    }
    if (this.sha256Hex(code) !== pending.codeHash) {
      await this.prisma.pendingRegistration.update({
        where: { id: pending.id },
        data: { codeAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Code de vérification invalide');
    }
    return this.completeEmailVerification(pending.id);
  }

  /**
   * Régénère un code/lien de vérification pour une inscription en attente
   * et renvoie l'email. Répond toujours avec un message générique (voir
   * commentaire ci-dessous), qu'une inscription en attente existe ou non.
   */
  async resendVerification(email: string) {
    const genericMessage = {
      message:
        'Si une inscription est en attente pour cet email, un nouveau code a été envoyé.',
    };
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });
    // Ne pas révéler si une inscription en attente existe (même logique que
    // forgotPassword) — la réponse est identique dans tous les cas.
    if (!pending) {
      return genericMessage;
    }

    const code = this.generateVerificationCode();
    const codeHash = this.sha256Hex(code);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRATION_MS);

    const updated = await this.prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { codeHash, codeAttempts: 0, expiresAt },
    });

    await this.sendVerificationEmail(
      updated.id,
      updated.email,
      updated.firstName,
      code,
    );

    return genericMessage;
  }

  /**
   * Crée le vrai User/Student à partir d'une PendingRegistration validée
   * (par lien ou par code — chemin partagé) et connecte automatiquement
   * l'utilisateur, comme le faisait l'ancien register() direct.
   */
  private async completeEmailVerification(pendingId: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { id: pendingId },
    });
    if (!pending) {
      throw new BadRequestException(
        'Cette demande de vérification est introuvable ou a déjà été utilisée.',
      );
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration
        .delete({ where: { id: pendingId } })
        .catch(() => undefined);
      throw new BadRequestException(
        'Ce lien a expiré, redemande une vérification.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: pending.email },
    });
    if (existingUser) {
      // Double clic sur le lien, ou lien + code utilisés en parallèle.
      await this.prisma.pendingRegistration
        .delete({ where: { id: pendingId } })
        .catch(() => undefined);
      throw new ConflictException('Cet email est déjà vérifié, connecte-toi.');
    }

    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'STUDENT' },
    });
    if (!studentRole) {
      throw new Error("Rôle STUDENT introuvable. Exécutez d'abord le seed.");
    }

    const user = await this.prisma.user.create({
      data: {
        email: pending.email,
        password: pending.passwordHash,
        roleId: studentRole.id,
        isVerified: true,
        acceptedTermsVersion: pending.acceptedTermsVersion,
        acceptedTermsAt: pending.acceptedTermsAt,
        student: {
          create: {
            firstName: pending.firstName,
            lastName: pending.lastName,
            phone: pending.phone,
          },
        },
      },
      include: {
        student: true,
        role: true,
      },
    });

    await this.prisma.pendingRegistration.delete({ where: { id: pendingId } });

    this.notifyN8n('student-created', 'student.created', user.id);

    const tokens = await this.issueTokens(user, true);
    const userInfo = this.extractUserInfo(user);

    return {
      ...tokens,
      user: userInfo,
    };
  }

  /** Génère un code de vérification à 6 chiffres (100000-999999). */
  private generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Hash SHA-256 hexadécimal générique : utilisé pour les codes de
   * vérification d'email et pour les tokens de réinitialisation de mot de
   * passe — dans les deux cas, seul le hash est stocké en base, jamais la
   * valeur en clair.
   */
  private sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Construit et envoie l'email de vérification (lien JWT 24h + code de
   * secours) pour une inscription en attente donnée.
   * @throws BadRequestException si l'envoi échoue — supprime alors la
   * PendingRegistration pour ne pas laisser l'utilisateur bloqué sans
   * moyen de recevoir un email (voir commentaire du catch ci-dessous).
   */
  private async sendVerificationEmail(
    pendingId: string,
    email: string,
    firstName: string,
    code: string,
  ) {
    const verifyToken = this.jwt.sign(
      { sub: pendingId, type: 'email_verify' },
      { expiresIn: EMAIL_VERIFICATION_JWT_EXPIRATION },
    );
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).split(',')[0];
    const verifyUrl = `${frontendUrl}/auth/verify-email?token=${verifyToken}&email=${encodeURIComponent(email)}`;

    try {
      // redactBody : ce message porte à la fois un lien de vérification
      // signé et un code à 6 chiffres — deux secrets à usage unique qui ne
      // doivent jamais atterrir en clair dans les logs applicatifs (voir le
      // même choix pour AuthService.forgotPassword). En simulation (aucun
      // provider réel configuré), seul NotificationService.writeLocalMailSink
      // permet de récupérer ce lien/code pour un test local.
      await this.notificationService.sendRawEmail({
        to: email,
        subject: 'Vérifie ton adresse email — GET',
        text: `Bonjour ${firstName},\n\nMerci de vérifier ton adresse email pour activer ton compte GET.\n\nClique sur ce lien (valable 24h) pour activer ton compte :\n${verifyUrl}\n\nOu saisis ce code de vérification sur la page d'inscription : ${code}\n\nSi tu n'es pas à l'origine de cette inscription, ignore cet email.`,
        redactBody: true,
      });
    } catch {
      // Échec d'envoi : on retire la demande en attente pour ne pas laisser
      // l'utilisateur bloqué avec un email jamais reçu et aucun moyen de
      // redemander (le prochain essai d'inscription en créera une neuve).
      await this.prisma.pendingRegistration
        .delete({ where: { id: pendingId } })
        .catch(() => undefined);
      throw new BadRequestException(
        "Impossible d'envoyer l'email de vérification, réessaie dans quelques instants.",
      );
    }
  }

  // ========== LOGIN ==========

  /**
   * Authentifie un utilisateur par email/mot de passe (bcrypt.compare).
   * Applique le verrouillage de compte (checkLoginAttempts) et redirige
   * vers le flux MFA si celui-ci est activé sur le compte.
   * @returns soit `{ mfaRequired: false, accessToken, refreshToken, user }`,
   * soit `{ mfaRequired: true, challengeToken }` si MFA activé.
   * @throws UnauthorizedException si l'email est inconnu, le compte est
   * verrouillé, le mot de passe est incorrect, ou l'email n'est pas vérifié.
   */
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
      const pending = await this.prisma.pendingRegistration.findUnique({
        where: { email: dto.email },
      });
      // Ne révèle le message "vérifie ton email" que si le mot de passe
      // fourni correspond bien à celui de l'inscription en attente — sinon
      // n'importe qui pourrait sonder cet endpoint pour savoir quels emails
      // ont une inscription non vérifiée en cours (énumération). Un
      // bcrypt.compare est toujours exécuté (contre un hash factice s'il n'y
      // a pas d'inscription en attente) pour que le timing de réponse ne
      // révèle pas non plus cette information.
      const matchesPending = await bcrypt.compare(
        dto.password,
        pending?.passwordHash ?? DUMMY_PASSWORD_HASH,
      );
      if (pending && matchesPending) {
        throw new UnauthorizedException(
          'Merci de vérifier ton adresse email avant de te connecter (vérifie ta boîte de réception et tes spams).',
        );
      }
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.checkLoginAttempts(user.id);

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.resetLoginAttempts(user.id);

    const rememberMe = dto.remember ?? true;

    if (user.mfaEnabled) {
      // Le mot de passe est valide mais le MFA est activé : on ne délivre
      // aucun jeton d'accès tant que le code TOTP n'est pas vérifié. Le choix
      // "se souvenir de moi" est fait à cette étape (le formulaire de
      // vérification du code n'a pas cette case) : il voyage dans le
      // challenge pour être appliqué une fois le code validé.
      const challengeToken = this.jwt.sign(
        { sub: user.id, type: 'mfa_challenge', rememberMe },
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

    const tokens = await this.issueTokens(user, rememberMe);
    const userInfo = this.extractUserInfo(user);

    return {
      mfaRequired: false as const,
      ...tokens,
      user: userInfo,
      rememberMe,
    };
  }

  // ========== MFA LOGIN (étape 2) ==========

  /**
   * Termine la connexion MFA : vérifie le challengeToken (5 min de
   * validité, type `mfa_challenge`) puis le code TOTP fourni.
   * @returns les tokens de session (access + refresh) et les infos utilisateur.
   * @throws UnauthorizedException si le challenge est invalide/expiré ou si
   * le compte n'a plus le MFA activé.
   * @throws BadRequestException si le code TOTP est incorrect.
   */
  async completeMfaLogin(challengeToken: string, code: string) {
    let payload: { sub: string; type: string; rememberMe?: boolean };
    try {
      payload = this.jwt.verify<{
        sub: string;
        type: string;
        rememberMe?: boolean;
      }>(challengeToken, {
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

    const rememberMe: boolean = payload.rememberMe ?? true;
    const tokens = await this.issueTokens(user, rememberMe);
    const userInfo = this.extractUserInfo(user);

    return {
      rememberMe,
      ...tokens,
      user: userInfo,
    };
  }

  // ========== REFRESH TOKEN ==========
  // L'access token dure volontairement peu (15 min) : c'est le refresh token
  // (7 jours, cookie httpOnly séparé) qui doit permettre d'en obtenir un
  // nouveau silencieusement, sans forcer une reconnexion tant que la session
  // n'a pas été explicitement révoquée (logout / changement de sessionVersion).
  /**
   * Échange un refresh token valide contre une nouvelle paire de tokens.
   * @throws UnauthorizedException si le refresh token est invalide/expiré,
   * porte un `type` (jeton à usage unique détourné), si l'utilisateur est
   * introuvable/inactif, si sessionVersion ne correspond plus (session
   * révoquée par un logout entre-temps), ou si le jti a déjà été consommé
   * par une rotation précédente (réutilisation détectée).
   */
  async refreshTokens(refreshToken: string) {
    let payload: {
      sub: string;
      sessionVersion: number;
      jti?: string;
      type?: string;
      rememberMe?: boolean;
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

    // Préserve le choix "se souvenir de moi" de la connexion d'origine —
    // sans ça, rafraîchir la session d'un utilisateur qui avait décoché la
    // case reposerait par erreur un cookie persistant.
    const rememberMe = payload.rememberMe ?? true;

    const newJti = randomUUID();
    // Rotation à usage unique : cette mise à jour ne matche que la ligne
    // RefreshSession dont le jti actuel est exactement celui présenté — donc
    // atomique (deux appels concurrents avec le même refresh token ne
    // peuvent pas tous les deux réussir la rotation, le perdant retombe dans
    // le cas count === 0 ci-dessous). Un jti qui ne matche plus rien (déjà
    // tourné, ou refresh token volé rejoué après coup) signale une
    // réutilisation : on la traite comme une compromission potentielle et on
    // révoque alors TOUTES les sessions de l'utilisateur, pas seulement
    // celle-ci — un attaquant en possession d'un refresh token volé ne doit
    // pas pouvoir se contenter d'attendre que le propriétaire légitime
    // rafraîchisse pour repartir d'un jti à jour.
    const { count } = await this.prisma.refreshSession.updateMany({
      where: {
        userId: user.id,
        currentJti: payload.jti ?? '',
        revokedAt: null,
      },
      data: { currentJti: newJti, lastUsedAt: new Date() },
    });

    if (count === 0) {
      await this.revokeSession(user.id);
      throw new UnauthorizedException(
        'Session révoquée, veuillez vous reconnecter',
      );
    }

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role!.name,
      user.sessionVersion,
      newJti,
      rememberMe,
    );
    const userInfo = this.extractUserInfo(user);

    return {
      rememberMe,
      ...tokens,
      user: userInfo,
    };
  }

  // ========== LOGOUT ==========

  /**
   * Révoque toutes les sessions de l'utilisateur en incrémentant
   * `sessionVersion` : tout access/refresh token émis avant cet appel
   * devient invalide, même s'il n'a pas expiré (mécanisme de révocation pour
   * des JWT stateless). Supprime aussi les chaînes de rotation
   * (RefreshSession) — sans ça, sessionVersion suffit déjà à bloquer un
   * refresh (voir refreshTokens), mais les lignes resteraient indéfiniment
   * en base.
   */
  async revokeSession(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      }),
      this.prisma.refreshSession.deleteMany({ where: { userId } }),
    ]);
  }

  // ========== FORGOT PASSWORD ==========

  /**
   * Envoie un email de réinitialisation de mot de passe. Le lien porte un
   * token opaque à usage unique (32 octets aléatoires) : seul son hash
   * SHA-256 est stocké en base (`User.resetTokenHash`), jamais le token en
   * clair — un accès en lecture à la base ne permet donc pas de forger une
   * réinitialisation. Valable 1h, invalidé après le premier usage (voir
   * resetPassword). Répond toujours avec le même message générique, que le
   * compte existe ou non, pour ne pas permettre l'énumération d'emails.
   */
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

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = this.sha256Hex(resetToken);
    const resetTokenExpiresAt = new Date(
      Date.now() + RESET_TOKEN_EXPIRATION_MS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenExpiresAt },
    });

    // FRONTEND_URL peut contenir plusieurs origines séparées par des
    // virgules (voir main.ts, même convention pour la liste CORS) — la
    // première est l'origine canonique à utiliser dans un lien envoyé par
    // email.
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).split(',')[0];
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    // Envoyé via sendRawEmail (jamais via send()) : ce dernier persiste le
    // corps du message dans Notification.body, ce qui laisserait le lien —
    // donc le token — lisible indéfiniment par quiconque peut lire cette
    // table. redactBody empêche aussi le fallback dev (sans SendGrid) de le
    // journaliser en clair — voir NotificationService.writeLocalMailSink
    // pour le seul canal (fichier local, jamais HTTP) par lequel ce lien
    // reste récupérable quand aucun email réel n'est envoyé. Ne jamais
    // propager une erreur d'envoi au client : le message reste générique
    // pour ne pas révéler l'existence du compte.
    try {
      await this.notificationService.sendRawEmail({
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe GET',
        text: `Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur ce lien (valable 1h, usage unique) pour choisir un nouveau mot de passe : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        redactBody: true,
      });
    } catch {
      // Échec d'envoi non bloquant pour la réponse HTTP — évite de révéler
      // l'existence du compte via un comportement différent en cas d'erreur.
    }

    // Le token de réinitialisation ne transite JAMAIS par la réponse HTTP,
    // quel que soit NODE_ENV : une instance non-production (QA/staging)
    // accessible sur le réseau exposerait sinon une prise de compte
    // triviale par énumération d'email (voir writeLocalMailSink pour le
    // canal de test local).
    return {
      message:
        'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
    };
  }

  /**
   * Applique un nouveau mot de passe (haché en bcrypt) après vérification
   * du token de réinitialisation opaque envoyé par forgotPassword. Consomme
   * le token, change le mot de passe et révoque toutes les sessions
   * existantes (`sessionVersion` incrémenté) en un seul `updateMany`
   * conditionné sur le hash ET l'expiration : une seule requête SQL, donc
   * atomique côté Postgres — deux requêtes concurrentes avec le même token
   * ne peuvent pas toutes les deux le consommer (la seconde ne matche plus
   * rien, le hash ayant déjà été effacé par la première). Un attaquant
   * ayant obtenu ce lien ne doit pas hériter d'une session ouverte par
   * ailleurs, et inversement une session compromise ne doit pas survivre à
   * la reprise de contrôle du compte par son propriétaire légitime.
   * @throws BadRequestException si le token est invalide ou expiré.
   */
  async resetPassword(token: string, newPassword: string) {
    const resetTokenHash = this.sha256Hex(token);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Récupéré uniquement pour nettoyer les RefreshSession ci-dessous — la
    // requête qui consomme réellement le token (et garantit l'atomicité
    // décrite plus haut) reste le updateMany suivant, avec les mêmes
    // conditions hash + expiration.
    const candidate = await this.prisma.user.findFirst({
      where: { resetTokenHash, resetTokenExpiresAt: { gt: new Date() } },
      select: { id: true },
    });

    const { count } = await this.prisma.user.updateMany({
      where: { resetTokenHash, resetTokenExpiresAt: { gt: new Date() } },
      data: {
        password: hashedPassword,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    });

    if (count === 0) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    if (candidate) {
      await this.prisma.refreshSession.deleteMany({
        where: { userId: candidate.id },
      });
    }

    return {
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
    };
  }

  // ========== MFA (activation/désactivation, déléguées à MfaService) ==========
  // Simples passe-plats vers MfaService : la logique TOTP/chiffrement du
  // secret vit entièrement dans ce service dédié.

  /** Génère le secret TOTP et le QR code d'activation MFA. Voir MfaService.generateSecret. */
  async enableMfa(userId: string, currentCode?: string) {
    return this.mfaService.generateSecret(userId, currentCode);
  }

  /** Confirme le code TOTP et active le MFA. Voir MfaService.verifyAndEnable. */
  async verifyMfa(userId: string, code: string) {
    return this.mfaService.verifyAndEnable(userId, code);
  }

  /** Désactive le MFA après vérification du code TOTP. Voir MfaService.disable. */
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
  private notifyN8n(
    webhookPath: string,
    eventType: string,
    entityId: string,
  ): void {
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

  /**
   * Construit l'objet utilisateur public (jamais de mot de passe/secret)
   * renvoyé dans les réponses d'authentification, avec un nom/prénom de
   * repli selon le type de profil (étudiant, admin école, ou générique
   * à partir de l'email).
   */
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

  /**
   * Signe une paire access token (courte durée, JWT_SECRET) / refresh token
   * (longue durée, JWT_REFRESH_SECRET — secret distinct) avec le même
   * payload `{ sub, email, role, sessionVersion, rememberMe }`.
   * `rememberMe` voyage dans le JWT (pas seulement dans le cookie) pour
   * survivre à un refresh : sans ça, rafraîchir la session d'un utilisateur
   * qui avait décoché "se souvenir de moi" reposerait par erreur un cookie
   * persistant (voir AuthController.refresh).
   */
  private generateTokens(
    userId: string,
    email: string,
    role: string,
    sessionVersion: number,
    refreshJti: string,
    rememberMe: boolean,
  ) {
    // `sessionVersion` est vérifié à chaque requête par JwtStrategy : un
    // jeton signé avec une valeur qui ne correspond plus à celle en base
    // (incrémentée à la déconnexion) est rejeté. C'est le mécanisme de
    // révocation de session côté serveur pour des JWT autrement stateless.
    const payload = { sub: userId, email, role, sessionVersion, rememberMe };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRATION', '15m'),
      secret: this.config.get('JWT_SECRET'),
    });

    // `jti` uniquement sur le refresh token : c'est lui que refreshTokens
    // compare à RefreshSession.currentJti pour la rotation à usage unique
    // (voir refreshTokens). L'access token n'en a pas besoin, il n'est
    // jamais échangé contre lui-même.
    const refreshToken = this.jwt.sign(
      { ...payload, jti: refreshJti },
      {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
        secret: this.config.get('JWT_REFRESH_SECRET'),
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Émet un nouveau couple access/refresh token pour une connexion réussie
   * (login, login MFA, vérification d'email) et crée la RefreshSession
   * correspondante — une chaîne de rotation par connexion, indépendante des
   * autres appareils/sessions déjà ouverts pour le même utilisateur (voir
   * refreshTokens pour la suite du cycle de vie de cette chaîne).
   */
  private async issueTokens(
    user: {
      id: string;
      email: string;
      role: { name: string } | null;
      sessionVersion: number;
    },
    rememberMe: boolean,
  ) {
    const jti = randomUUID();
    await this.prisma.refreshSession.create({
      data: { userId: user.id, currentJti: jti },
    });
    return this.generateTokens(
      user.id,
      user.email,
      user.role!.name,
      user.sessionVersion,
      jti,
      rememberMe,
    );
  }

  // ========== LOGIN ATTEMPTS ==========

  /**
   * Vérifie si le compte est actuellement verrouillé (>= MAX_LOGIN_ATTEMPTS
   * échecs consécutifs et dernier échec datant de moins de LOCK_TIME). Si le
   * verrou a expiré, réinitialise silencieusement le compteur.
   * @throws UnauthorizedException si le compte est verrouillé.
   */
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

  /** Incrémente le compteur d'échecs de connexion et horodate le dernier échec. */
  private async incrementLoginAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: { increment: 1 },
        lastFailedLoginAt: new Date(),
      },
    });
  }

  /** Réinitialise le compteur d'échecs de connexion après un login réussi. */
  private async resetLoginAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
    });
  }
}
