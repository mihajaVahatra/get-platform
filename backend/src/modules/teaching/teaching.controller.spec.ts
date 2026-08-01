import { BadRequestException } from '@nestjs/common';
import { TeacherProfileController } from './teaching.controller';
import { TeachingService } from './teaching.service';
import { StorageService } from '../../common/services/storage.service';

describe('TeacherProfileController', () => {
  let controller: TeacherProfileController;
  let teaching: {
    profile: jest.Mock;
    updateProfile: jest.Mock;
    changePassword: jest.Mock;
    updateTheme: jest.Mock;
    updateAvatar: jest.Mock;
  };
  let storageService: { uploadImage: jest.Mock };

  beforeEach(() => {
    teaching = {
      profile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      updateTheme: jest.fn(),
      updateAvatar: jest.fn(),
    };
    storageService = { uploadImage: jest.fn() };
    controller = new TeacherProfileController(
      teaching as unknown as TeachingService,
      storageService as unknown as StorageService,
    );
  });

  it('délègue la lecture du profil au service avec l’identifiant connecté', () => {
    teaching.profile.mockResolvedValue({ id: 'teacher-1' });

    controller.profile('user-1');

    expect(teaching.profile).toHaveBeenCalledWith('user-1');
  });

  it('délègue la mise à jour du profil avec les champs du DTO', () => {
    const dto = { firstName: 'Haja', lastName: 'Raso', phone: '034 00' };

    controller.updateProfile('user-1', dto);

    expect(teaching.updateProfile).toHaveBeenCalledWith('user-1', dto);
  });

  it('transmet le mot de passe actuel et le nouveau au service', () => {
    controller.changePassword('user-1', {
      currentPassword: 'Ancien123!',
      newPassword: 'Nouveau123!',
    });

    expect(teaching.changePassword).toHaveBeenCalledWith(
      'user-1',
      'Ancien123!',
      'Nouveau123!',
    );
  });

  it('transmet la préférence de thème choisie au service', () => {
    controller.updateTheme('user-1', { theme: 'dark' });

    expect(teaching.updateTheme).toHaveBeenCalledWith('user-1', 'dark');
  });

  it('refuse l’upload d’avatar sans fichier', async () => {
    await expect(
      controller.uploadAvatar('user-1', undefined as unknown as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(teaching.updateAvatar).not.toHaveBeenCalled();
  });

  it('stocke l’avatar puis met à jour le profil avec son URL', async () => {
    teaching.profile.mockResolvedValue({ id: 'teacher-1' });
    storageService.uploadImage.mockResolvedValue({
      url: 'https://storage.test/avatar.png',
    });
    teaching.updateAvatar.mockResolvedValue({
      avatarUrl: 'https://storage.test/avatar.png',
    });

    const file = { originalname: 'avatar.png' } as Express.Multer.File;
    await expect(
      controller.uploadAvatar('user-1', file),
    ).resolves.toEqual({ avatarUrl: 'https://storage.test/avatar.png' });

    expect(storageService.uploadImage).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ entityId: 'teacher-1' }),
    );
    expect(teaching.updateAvatar).toHaveBeenCalledWith(
      'user-1',
      'https://storage.test/avatar.png',
    );
  });
});
