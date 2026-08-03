import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementService } from './announcement.service';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let prisma: {
    announcement: { create: jest.Mock };
    notification: { createMany: jest.Mock };
    announcementRecipient: { createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      announcement: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'announcement-1', title: 'Consigne', body: 'À lire' }),
      },
      notification: { createMany: jest.fn() },
      announcementRecipient: { createMany: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    service = new AnnouncementService(prisma as unknown as PrismaService);
  });

  it('crée une notification par destinataire unique et relie chacune à son annonce, dans une transaction', async () => {
    const result = await service.createAndNotify(
      {
        schoolId: 'school-1',
        authorId: 'user-1',
        title: ' Consigne ',
        body: ' À lire ',
        targetType: 'COURSE_STUDENTS',
      },
      ['student-1', 'student-2', 'student-1'],
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: {
        schoolId: 'school-1',
        authorId: 'user-1',
        courseId: undefined,
        title: 'Consigne',
        body: 'À lire',
        targetType: 'COURSE_STUDENTS',
        targetClasses: [],
      },
    });

    const notifyCall = prisma.notification.createMany.mock.calls[0][0];
    expect(notifyCall.data).toHaveLength(2);
    const recipientCall = prisma.announcementRecipient.createMany.mock.calls[0][0];
    expect(recipientCall.data).toHaveLength(2);
    expect(recipientCall.data[0].notificationId).toBe(notifyCall.data[0].id);
    expect(recipientCall.data[0].announcementId).toBe('announcement-1');

    expect(result).toEqual({
      announcementId: 'announcement-1',
      recipientCount: 2,
    });
  });

  it('ne crée aucune notification si la liste de destinataires est vide', async () => {
    await service.createAndNotify(
      {
        schoolId: 'school-1',
        authorId: 'user-1',
        title: 'Consigne',
        body: 'À lire',
        targetType: 'ALL_STUDENTS',
      },
      [],
    );

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.announcementRecipient.createMany).not.toHaveBeenCalled();
  });
});
