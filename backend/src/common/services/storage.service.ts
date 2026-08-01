import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../modules/prisma/prisma.service';

export enum ImageEntityType {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  SCHOOL = 'SCHOOL',
  ADMIN = 'ADMIN',
  MINISTRY = 'MINISTRY',
  OFFER = 'OFFER',
  SYSTEM = 'SYSTEM',
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

@Injectable()
export class StorageService {
  private uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.uploadDir = this.config.get('UPLOAD_DIR') || './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
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
    const fullPath = this.resolveUploadPath(folder, subFolder, entityFolder);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    const filePath = this.resolveUploadPath(
      folder,
      subFolder,
      entityFolder,
      fileName,
    );
    fs.writeFileSync(filePath, file.buffer);

    const baseUrl =
      this.config.get<string>('STORAGE_URL') || 'http://localhost:3001';
    const url = `${baseUrl}/uploads/${folder}/${subFolder}/${entityFolder}/${fileName}`;

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

  uploadDocument(
    file: Express.Multer.File,
    studentId: string,
  ): { url: string } {
    this.assertSafeDocument(file);
    this.assertSafeEntityId(studentId);

    const fileName = this.generateFileName(file.originalname);
    const fullPath = this.resolveUploadPath('documents', studentId);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    fs.writeFileSync(
      this.resolveUploadPath('documents', studentId, fileName),
      file.buffer,
    );

    const baseUrl =
      this.config.get<string>('STORAGE_URL') || 'http://localhost:3001';
    return { url: `${baseUrl}/uploads/documents/${studentId}/${fileName}` };
  }

  uploadCourseMaterial(
    file: Express.Multer.File,
    courseId: string,
  ): { url: string } {
    this.assertSafeDocument(file, { allowCourseMaterials: true });
    this.assertSafeEntityId(courseId);

    const fileName = this.generateFileName(file.originalname);
    const fullPath = this.resolveUploadPath('course-materials', courseId);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    fs.writeFileSync(
      this.resolveUploadPath('course-materials', courseId, fileName),
      file.buffer,
    );

    const baseUrl =
      this.config.get<string>('STORAGE_URL') || 'http://localhost:3001';
    return {
      url: `${baseUrl}/uploads/course-materials/${courseId}/${fileName}`,
    };
  }

  saveMessageAttachment(
    file: Express.Multer.File,
    messageId: string,
  ): {
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    kind: MessageAttachmentKind;
  } {
    const kind = this.assertSafeMessageAttachment(file);
    this.assertSafeEntityId(messageId);

    const fileName = this.generateFileName(file.originalname);
    const fullPath = this.resolveUploadPath('messages', messageId);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    fs.writeFileSync(
      this.resolveUploadPath('messages', messageId, fileName),
      file.buffer,
    );

    const baseUrl =
      this.config.get<string>('STORAGE_URL') || 'http://localhost:3001';
    return {
      url: `${baseUrl}/uploads/messages/${messageId}/${fileName}`,
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
    await this.prisma.image.delete({ where: { id: imageId } });
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

  private resolveUploadPath(...segments: string[]) {
    const root = path.resolve(this.uploadDir);
    const resolved = path.resolve(root, ...segments);
    const relative = path.relative(root, resolved);
    if (
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new BadRequestException('Chemin de stockage invalide');
    }
    return resolved;
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
