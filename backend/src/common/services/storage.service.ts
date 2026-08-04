import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../modules/prisma/prisma.service';

export enum ImageEntityType {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  SCHOOL = 'SCHOOL',
  ADMIN = 'ADMIN',
  MINISTRY = 'MINISTRY',
  OFFER = 'OFFER',
  SYSTEM = 'SYSTEM',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  LANDING_NEWS = 'LANDING_NEWS',
  FINANCIAL_PARTNER = 'FINANCIAL_PARTNER',
}

export enum ImageType {
  AVATAR = 'AVATAR',
  LOGO = 'LOGO',
  ILLUSTRATION = 'ILLUSTRATION',
  BANNER = 'BANNER',
}

export type MessageAttachmentKind = 'IMAGE' | 'DOCUMENT' | 'VIDEO';

const MESSAGE_ATTACHMENT_LIMITS: Record<MessageAttachmentKind, number> = {
  IMAGE: 5 * 1024 * 1024,
  DOCUMENT: 5 * 1024 * 1024,
  VIDEO: 20 * 1024 * 1024,
};

// Durée de validité des URLs présignées servies pour les fichiers protégés
// (documents, supports de cours, pièces jointes) : courte pour limiter la
// fenêtre de partage involontaire d'un lien, largement suffisante pour un
// téléchargement immédiat déclenché par le navigateur.
const PRESIGNED_URL_TTL_SECONDS = 60;

/**
 * Stockage S3-compatible (MinIO en local/self-hosted, Cloudflare R2, AWS S3
 * en production). Remplace l'ancien stockage sur disque local : le
 * filesystem d'un hébergeur comme Railway est éphémère (perdu à chaque
 * redéploiement), donc tout fichier utilisateur doit vivre en dehors du
 * process applicatif.
 *
 * Toutes les validations de contenu (magic bytes, mimetypes) sont
 * inchangées par rapport à la version disque — elles opèrent sur le buffer
 * en mémoire, jamais sur le filesystem.
 */
@Injectable()
export class StorageService {
  private client: S3Client;
  // Deux buckets plutôt qu'une ACL par objet : la plupart des fournisseurs
  // S3-compatibles (MinIO en tête) ne respectent pas de façon fiable l'ACL
  // "public-read" posée sur un objet individuel — seule une politique au
  // niveau du bucket est honorée partout (MinIO, R2, AWS S3).
  private privateBucket: string;
  private publicBucket: string;
  private publicUrl?: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.privateBucket =
      this.config.get<string>('S3_BUCKET') || 'get-poc-uploads';
    this.publicBucket =
      this.config.get<string>('S3_PUBLIC_BUCKET') || 'get-poc-public';
    this.publicUrl = this.config.get<string>('S3_PUBLIC_URL');
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') || 'us-east-1',
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE') !== 'false',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID') || '',
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    options: {
      entityType: ImageEntityType;
      entityId?: string;
      type: ImageType;
    },
  ): Promise<{ id: string; url: string }> {
    this.assertSafeImage(file);
    this.assertSafeEntityId(options.entityId);
    const fileName = this.generateFileName(file.originalname);
    const folder = options.entityType.toLowerCase();
    const subFolder = options.type.toLowerCase();
    const entityFolder = options.entityId || 'system';
    const key = this.buildKey(folder, subFolder, entityFolder, fileName);

    // Fichier public par nature (avatar, logo, bannière) : bucket public,
    // accès direct via son URL, pas besoin de passer par ce backend.
    await this.putObject(this.publicBucket, key, file);
    const url = this.publicObjectUrl(key);

    const image = await this.prisma.image.create({
      data: {
        url,
        type: options.type,
        entityType: options.entityType,
        entityId: options.entityId,
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    return { id: image.id, url: image.url };
  }

  async uploadDocument(
    file: Express.Multer.File,
    studentId: string,
  ): Promise<{ url: string }> {
    this.assertSafeDocument(file);
    this.assertSafeEntityId(studentId);

    const fileName = this.generateFileName(file.originalname);
    const key = this.buildKey('documents', studentId, fileName);
    await this.putObject(this.privateBucket, key, file);

    return { url: this.protectedObjectUrl('documents', studentId, fileName) };
  }

  async uploadCourseMaterial(
    file: Express.Multer.File,
    courseId: string,
  ): Promise<{ url: string }> {
    this.assertSafeDocument(file, { allowCourseMaterials: true });
    this.assertSafeEntityId(courseId);

    const fileName = this.generateFileName(file.originalname);
    const key = this.buildKey('course-materials', courseId, fileName);
    await this.putObject(this.privateBucket, key, file);

    return {
      url: this.protectedObjectUrl('course-materials', courseId, fileName),
    };
  }

  async saveMessageAttachment(
    file: Express.Multer.File,
    messageId: string,
  ): Promise<{
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    kind: MessageAttachmentKind;
  }> {
    const kind = this.assertSafeMessageAttachment(file);
    this.assertSafeEntityId(messageId);

    const fileName = this.generateFileName(file.originalname);
    const key = this.buildKey('messages', messageId, fileName);
    await this.putObject(this.privateBucket, key, file);

    return {
      url: this.protectedObjectUrl('messages', messageId, fileName),
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      kind,
    };
  }

  async getImage(
    entityType: ImageEntityType,
    entityId: string,
    type: ImageType,
  ): Promise<string | null> {
    const image = await this.prisma.image.findFirst({
      where: { entityType, entityId, type },
      orderBy: { createdAt: 'desc' },
    });
    return image?.url || null;
  }

  async deleteImage(imageId: string): Promise<void> {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
    });
    if (!image) return;
    const key = this.keyFromPublicUrl(image.url);
    if (key) {
      await this.client
        .send(new DeleteObjectCommand({ Bucket: this.publicBucket, Key: key }))
        .catch((error) =>
          // Échec non bloquant pour ne pas empêcher la suppression de
          // l'enregistrement (l'utilisateur ne doit pas rester coincé avec
          // une image qu'il ne peut pas remplacer), mais journalisé : un
          // objet S3 orphelin reste accessible publiquement à son URL tant
          // qu'il n'est pas nettoyé manuellement.
          console.warn(
            `StorageService.deleteImage: échec de suppression S3 pour la clé "${key}" (image ${imageId})`,
            error,
          ),
        );
    } else {
      console.warn(
        `StorageService.deleteImage: impossible de dériver la clé S3 depuis l'URL stockée pour l'image ${imageId} — objet non supprimé du bucket (${image.url})`,
      );
    }
    await this.prisma.image.delete({ where: { id: imageId } });
  }

  /**
   * Génère une URL de téléchargement à courte durée de vie pour un fichier
   * protégé, une fois l'autorisation déjà vérifiée par l'appelant (voir
   * `protected-uploads.middleware.ts`).
   */
  async createPresignedDownloadUrl(
    ...segments: string[]
  ): Promise<string | null> {
    const key = this.buildKey(...segments);
    const exists = await this.headObject(this.privateBucket, key);
    if (!exists) return null;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.privateBucket, Key: key }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS },
    );
  }

  private async putObject(
    bucket: string,
    key: string,
    file: Express.Multer.File,
  ) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
  }

  private async headObject(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private buildKey(...segments: string[]) {
    // Même garde-fou de traversée de chemin que l'ancienne version disque,
    // appliqué ici à la clé d'objet plutôt qu'à un chemin filesystem.
    for (const segment of segments) {
      if (segment.includes('..') || path.isAbsolute(segment)) {
        throw new BadRequestException('Chemin de stockage invalide');
      }
    }
    return segments.join('/');
  }

  private publicObjectUrl(key: string): string {
    if (this.publicUrl) return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    const endpoint = this.config.get<string>('S3_ENDPOINT') || '';
    return `${endpoint.replace(/\/$/, '')}/${this.publicBucket}/${key}`;
  }

  // Symétrique de `publicObjectUrl` : reconnaît les DEUX formes d'URL que
  // cette méthode peut produire (avec ou sans `S3_PUBLIC_URL` configuré),
  // pas seulement celle qui correspond à la configuration *actuelle*. Sans
  // ça, une image uploadée avant qu'une des deux variables ne change de
  // valeur devenait indérivable : la clé S3 originale n'était plus jamais
  // retrouvée, l'objet restait orphelin (accessible publiquement) même
  // après suppression de l'enregistrement en base.
  private keyFromPublicUrl(url: string): string | null {
    if (this.publicUrl) {
      const prefix = `${this.publicUrl.replace(/\/$/, '')}/`;
      if (url.startsWith(prefix)) {
        return url.slice(prefix.length);
      }
    }
    const endpoint = this.config.get<string>('S3_ENDPOINT') || '';
    if (endpoint) {
      const endpointPrefix = `${endpoint.replace(/\/$/, '')}/${this.publicBucket}/`;
      if (url.startsWith(endpointPrefix)) {
        return url.slice(endpointPrefix.length);
      }
    }
    return null;
  }

  // Conserve exactement la même forme d'URL/route qu'à l'époque du disque
  // local (`/uploads/<dossier>/...`) : `protected-uploads.middleware.ts`
  // continue d'intercepter ces routes, il ne fait plus que rediriger vers
  // une URL présignée au lieu de streamer le fichier depuis le disque.
  private protectedObjectUrl(...segments: string[]): string {
    const baseUrl =
      this.config.get<string>('APP_URL') || 'http://localhost:3001';
    return `${baseUrl}/uploads/${segments.join('/')}`;
  }

  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const base = crypto.randomBytes(16).toString('hex');
    return `${base}${ext.toLowerCase()}`;
  }

  private assertSafeEntityId(entityId?: string) {
    if (!entityId) return;

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(entityId)) {
      throw new BadRequestException('Identifiant de dossier invalide');
    }
  }

  private assertSafeImage(file: Express.Multer.File) {
    const supported = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!supported.has(file.mimetype))
      throw new BadRequestException('Format image non autorisé');
    const bytes = file.buffer;
    const isPng =
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    const isWebp =
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString() === 'RIFF' &&
      bytes.subarray(8, 12).toString() === 'WEBP';
    if (!isPng && !isJpeg && !isWebp)
      throw new BadRequestException(
        'Le contenu du fichier ne correspond pas à une image valide',
      );
  }

  private assertSafeDocument(
    file: Express.Multer.File,
    options: { allowCourseMaterials?: boolean } = {},
  ) {
    const allowedMimes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ...(options.allowCourseMaterials
        ? [
            'image/webp',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/x-zip-compressed',
          ]
        : []),
    ]);
    if (!allowedMimes.has(file.mimetype)) {
      throw new BadRequestException('Format de document non autorisé');
    }

    const bytes = file.buffer;
    const isPdf =
      bytes.length >= 5 && bytes.subarray(0, 5).toString() === '%PDF-';
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      this.assertSafeImage(file);
      return;
    }
    const isDoc =
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const isDocx =
      bytes.length >= 4 && bytes.subarray(0, 4).toString() === 'PK\x03\x04';

    const contentMatchesMime =
      (file.mimetype === 'application/pdf' && isPdf) ||
      (file.mimetype === 'application/msword' && isDoc) ||
      (file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
        isDocx) ||
      (options.allowCourseMaterials &&
        [
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip',
          'application/x-zip-compressed',
        ].includes(file.mimetype) &&
        isDocx);

    if (!contentMatchesMime) {
      throw new BadRequestException(
        'Le contenu du fichier ne correspond pas à son format déclaré',
      );
    }
  }

  private assertSafeVideo(file: Express.Multer.File) {
    const supported = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
    if (!supported.has(file.mimetype))
      throw new BadRequestException('Format vidéo non autorisé');

    const bytes = file.buffer;
    const isMp4OrMov =
      bytes.length >= 8 && bytes.subarray(4, 8).toString() === 'ftyp';
    const isWebm =
      bytes.length >= 4 &&
      bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const contentMatchesMime =
      (['video/mp4', 'video/quicktime'].includes(file.mimetype) &&
        isMp4OrMov) ||
      (file.mimetype === 'video/webm' && isWebm);
    if (!contentMatchesMime)
      throw new BadRequestException(
        'Le contenu du fichier ne correspond pas à une vidéo valide',
      );
  }

  private assertSafeMessageAttachment(
    file: Express.Multer.File,
  ): MessageAttachmentKind {
    const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const documentMimes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const videoMimes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

    let kind: MessageAttachmentKind;
    if (imageMimes.has(file.mimetype)) {
      this.assertSafeImage(file);
      kind = 'IMAGE';
    } else if (documentMimes.has(file.mimetype)) {
      this.assertSafeDocument(file);
      kind = 'DOCUMENT';
    } else if (videoMimes.has(file.mimetype)) {
      this.assertSafeVideo(file);
      kind = 'VIDEO';
    } else {
      throw new BadRequestException('Type de pièce jointe non autorisé');
    }

    if (file.size > MESSAGE_ATTACHMENT_LIMITS[kind]) {
      throw new BadRequestException(
        `Ce fichier dépasse la taille maximale autorisée (${MESSAGE_ATTACHMENT_LIMITS[kind] / (1024 * 1024)} Mo)`,
      );
    }
    return kind;
  }
}
