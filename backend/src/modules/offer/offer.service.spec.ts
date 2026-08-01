import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OfferService } from './offer.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OfferService', () => {
  let service: OfferService;
  let prisma: {
    school: { findFirst: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
    schoolRequirement: { count: jest.Mock };
    offer: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      school: { findFirst: jest.fn() },
      schoolProgram: { findFirst: jest.fn() },
      schoolRequirement: { count: jest.fn() },
      offer: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    service = new OfferService(prisma as unknown as PrismaService);
  });

  const baseDto = {
    programId: 'program-1',
    title: 'Master Finance',
    schoolId: 'school-1',
    diploma: 'Master',
    duration: '2 ans',
    tuitionFees: 1000,
    capacity: 30,
    academicYear: '2026-2027',
  };

  it('refuse de créer une offre pour une école introuvable', async () => {
    prisma.school.findFirst.mockResolvedValue(null);

    await expect(service.create(baseDto as any, 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('refuse de créer une offre pour un administrateur d’une autre école', async () => {
    prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({
      role: { name: 'SCHOOL_ADMIN' },
      schoolAdmin: { schoolId: 'other-school' },
    });

    await expect(service.create(baseDto as any, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('refuse de créer une offre pour une filière ne correspondant pas à l’école', async () => {
    prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({
      role: { name: 'SCHOOL_ADMIN' },
      schoolAdmin: { schoolId: 'school-1' },
    });
    prisma.schoolProgram.findFirst.mockResolvedValue(null);

    await expect(service.create(baseDto as any, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('crée l’offre lorsque l’école, la filière et les droits sont valides', async () => {
    prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({
      role: { name: 'SCHOOL_ADMIN' },
      schoolAdmin: { schoolId: 'school-1' },
    });
    prisma.schoolProgram.findFirst.mockResolvedValue({ id: 'program-1' });
    prisma.offer.create.mockResolvedValue({ id: 'offer-1' });

    await expect(service.create(baseDto as any, 'user-1')).resolves.toEqual({
      id: 'offer-1',
    });
    expect(prisma.offer.create).toHaveBeenCalled();
  });

  it('empêche un administrateur d’une autre école de retirer une offre', async () => {
    prisma.offer.findFirst.mockResolvedValue({
      id: 'offer-1',
      schoolId: 'school-1',
      deletedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      role: { name: 'SCHOOL_ADMIN' },
      schoolAdmin: { schoolId: 'other-school' },
    });

    await expect(service.delete('offer-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.offer.update).not.toHaveBeenCalled();
  });

  it('marque l’offre comme supprimée (soft delete) pour l’école propriétaire', async () => {
    prisma.offer.findFirst.mockResolvedValue({
      id: 'offer-1',
      schoolId: 'school-1',
      deletedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      role: { name: 'SCHOOL_ADMIN' },
      schoolAdmin: { schoolId: 'school-1' },
    });
    prisma.offer.update.mockResolvedValue({ id: 'offer-1' });

    await service.delete('offer-1', 'user-1');

    expect(prisma.offer.update).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('bascule l’ouverture d’une offre pour l’école propriétaire', async () => {
    prisma.offer.findFirst.mockResolvedValue({
      id: 'offer-1',
      schoolId: 'school-1',
      deletedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
    prisma.offer.update.mockResolvedValue({ id: 'offer-1', isOpen: false });

    await service.toggleStatus('offer-1', false, 'admin-1');

    expect(prisma.offer.update).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
      data: { isOpen: false },
    });
  });
});
