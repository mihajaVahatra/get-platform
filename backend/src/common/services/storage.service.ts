import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../modules/prisma/prisma.service';

export enum ImageEntityType {
  STUDENT = 'STUDENT',
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
    const fileName = this.generateFileName(file.originalname);
    const folder = options.entityType.toLowerCase();
    const subFolder = options.type.toLowerCase();
    const entityFolder = options.entityId || 'system';
    const fullPath = path.join(this.uploadDir, folder, subFolder, entityFolder);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    const filePath = path.join(fullPath, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const baseUrl = this.config.get('STORAGE_URL') || 'http://localhost:3001';
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
}
