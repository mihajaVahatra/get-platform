import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { StorageService } from './storage.service';

describe('StorageService — ressources de cours', () => {
  it('rejette un faux PDF avant de l’envoyer au stockage S3', async () => {
    const storage = new StorageService(
      {} as PrismaService,
      { get: jest.fn().mockReturnValue('/tmp') } as unknown as ConfigService,
    );

    await expect(
      storage.uploadCourseMaterial(
        {
          originalname: 'programme.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('MZ executable content'),
        } as Express.Multer.File,
        '123e4567-e89b-42d3-a456-426614174000',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

/** Accède au client S3 privé de `StorageService` pour espionner `send()` sans dépendre d'une vraie connexion S3. */
function s3ClientOf(storage: StorageService) {
  return (storage as unknown as { client: { send: jest.Mock } }).client;
}

describe('StorageService — deleteObject', () => {
  function buildStorage() {
    return new StorageService(
      {} as PrismaService,
      { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    );
  }

  it('supprime l’objet S3 correspondant à la clé reconstituée depuis les segments', async () => {
    const storage = buildStorage();
    const sendSpy = jest
      .spyOn(s3ClientOf(storage), 'send')
      .mockResolvedValue({});

    await storage.deleteObject('documents', 'student-1', 'file.pdf');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const command = sendSpy.mock.calls[0][0] as { input: unknown };
    expect(command.input).toEqual(
      expect.objectContaining({ Key: 'documents/student-1/file.pdf' }),
    );
  });

  it('reste best-effort : un échec S3 est journalisé mais ne fait jamais échouer l’appel', async () => {
    const storage = buildStorage();
    jest
      .spyOn(s3ClientOf(storage), 'send')
      .mockRejectedValue(new Error('S3 indisponible'));
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      storage.deleteObject('documents', 'student-1', 'file.pdf'),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
