import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { StorageService } from './storage.service';

describe('StorageService — ressources de cours', () => {
  it('rejette un faux PDF avant de l’écrire sur le disque', () => {
    const storage = new StorageService(
      {} as PrismaService,
      { get: jest.fn().mockReturnValue('/tmp') } as unknown as ConfigService,
    );

    expect(() =>
      storage.uploadCourseMaterial(
        {
          originalname: 'programme.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('MZ executable content'),
        } as Express.Multer.File,
        '123e4567-e89b-42d3-a456-426614174000',
      ),
    ).toThrow(BadRequestException);
  });
});
