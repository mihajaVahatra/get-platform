import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from './school.service';
import { ScheduleGenerationService } from './schedule-generation.service';

describe('ScheduleGenerationService', () => {
  let service: ScheduleGenerationService;
  let prisma: {
    schoolTimeSlot: { findMany: jest.Mock };
    room: { findMany: jest.Mock };
    schoolClass: { findMany: jest.Mock };
    course: { update: jest.Mock };
    courseSlot: { findFirst: jest.Mock };
  };
  let schoolService: { createCourse: jest.Mock; createCourseSlot: jest.Mock };

  const oneTimeSlot = [{ id: 'ts-1', dayOfWeek: 1, startTime: '08:00', endTime: '10:00' }];
  const oneRoom = [{ id: 'room-1', name: 'Salle A' }];

  const teacher = { id: 'teacher-1', firstName: 'Jean', lastName: 'Rakoto' };

  function requirement(overrides: Record<string, unknown> = {}) {
    return {
      id: 'req-1',
      subjectId: 'subj-1',
      subject: { id: 'subj-1', name: 'Maths' },
      hoursPerWeek: 2,
      assignment: { teacherId: teacher.id, teacher },
      course: null,
      ...overrides,
    };
  }

  function schoolClass(overrides: Record<string, unknown> = {}) {
    return {
      id: 'class-1',
      name: 'Classe A',
      programId: 'program-1',
      program: { id: 'program-1', durationYears: 3 },
      level: 1,
      requirements: [requirement()],
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      schoolTimeSlot: { findMany: jest.fn().mockResolvedValue(oneTimeSlot) },
      room: { findMany: jest.fn().mockResolvedValue(oneRoom) },
      schoolClass: { findMany: jest.fn().mockResolvedValue([schoolClass()]) },
      course: { update: jest.fn().mockResolvedValue({}) },
      courseSlot: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    schoolService = {
      createCourse: jest.fn().mockResolvedValue({ id: 'course-1' }),
      createCourseSlot: jest.fn().mockResolvedValue({ id: 'slot-1' }),
    };
    service = new ScheduleGenerationService(
      prisma as unknown as PrismaService,
      schoolService as unknown as SchoolService,
    );
  });

  it('remonte en non résolu un besoin sans professeur affecté, sans créer de cours', async () => {
    prisma.schoolClass.findMany.mockResolvedValue([
      schoolClass({ requirements: [requirement({ assignment: null })] }),
    ]);

    const result = await service.generate('school-1', { academicYearId: 'year-1' });

    expect(result.createdSlots).toBe(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reason).toBe('Aucun professeur affecté');
    expect(schoolService.createCourse).not.toHaveBeenCalled();
  });

  it("remonte en non résolu une classe sans filière associée", async () => {
    prisma.schoolClass.findMany.mockResolvedValue([
      schoolClass({ programId: null, program: null }),
    ]);

    const result = await service.generate('school-1', { academicYearId: 'year-1' });

    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reason).toBe('Classe sans filière associée');
    expect(schoolService.createCourse).not.toHaveBeenCalled();
  });

  it("remonte tout en non résolu sans planter si aucun créneau-type ou salle n'est actif", async () => {
    prisma.schoolTimeSlot.findMany.mockResolvedValue([]);

    const result = await service.generate('school-1', { academicYearId: 'year-1' });

    expect(result.createdSlots).toBe(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reason).toBe(
      'Aucun créneau-type ou salle active configuré pour cette école',
    );
  });

  it('crée le cours et place la séance quand tout est disponible', async () => {
    const result = await service.generate('school-1', { academicYearId: 'year-1' });

    expect(schoolService.createCourse).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        teacherId: teacher.id,
        subjectId: 'subj-1',
        programId: 'program-1',
        programLevel: 1,
      }),
    );
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { subjectRequirementId: 'req-1' },
    });
    expect(schoolService.createCourseSlot).toHaveBeenCalledWith('school-1', 'course-1', {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      room: 'Salle A',
    });
    expect(result.createdSlots).toBe(1);
    expect(result.unresolved).toHaveLength(0);
  });

  it('est idempotent : ne recrée pas de séance déjà placée lors d’un re-run', async () => {
    prisma.schoolClass.findMany.mockResolvedValue([
      schoolClass({
        requirements: [
          requirement({
            course: { id: 'course-1', slots: [{ id: 'slot-existing' }] },
          }),
        ],
      }),
    ]);

    const result = await service.generate('school-1', { academicYearId: 'year-1' });

    expect(schoolService.createCourse).not.toHaveBeenCalled();
    expect(schoolService.createCourseSlot).not.toHaveBeenCalled();
    expect(result.createdSlots).toBe(0);
    expect(result.unresolved).toHaveLength(0);
  });

  it('ne place jamais deux besoins de la même classe sur le même créneau', async () => {
    // Un seul créneau-type/une seule salle disponibles ; deux besoins pour la
    // même classe. Le premier prend le créneau, isClassBusy doit bloquer le second.
    prisma.courseSlot.findFirst
      .mockResolvedValueOnce(null) // isClassBusy pour le 1er besoin (Anglais) : libre
      .mockResolvedValueOnce({ id: 'conflict' }); // isClassBusy pour le 2nd besoin (Maths) : occupé

    schoolService.createCourse
      .mockResolvedValueOnce({ id: 'course-anglais' })
      .mockResolvedValueOnce({ id: 'course-maths' });

    prisma.schoolClass.findMany.mockResolvedValue([
      schoolClass({
        requirements: [
          requirement({ id: 'req-maths', subject: { id: 'subj-maths', name: 'Maths' } }),
          requirement({
            id: 'req-anglais',
            subjectId: 'subj-anglais',
            subject: { id: 'subj-anglais', name: 'Anglais' },
          }),
        ],
      }),
    ]);

    const result = await service.generate('school-1', { academicYearId: 'year-1' });

    // Anglais (tri alphabétique à hoursPerWeek égal) est traité en premier et obtient le créneau.
    expect(schoolService.createCourseSlot).toHaveBeenCalledTimes(1);
    expect(result.createdSlots).toBe(1);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].subjectName).toBe('Maths');
    expect(result.unresolved[0].reason).toContain('Aucun créneau libre compatible');
  });

  it('applique le filtre par matière à la requête des besoins', async () => {
    await service.generate('school-1', { academicYearId: 'year-1', subjectId: 'subj-x' });

    expect(prisma.schoolClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          requirements: expect.objectContaining({
            where: expect.objectContaining({ subjectId: 'subj-x' }),
          }),
        }),
      }),
    );
  });

  it('applique le filtre par professeur à la requête des besoins', async () => {
    await service.generate('school-1', { academicYearId: 'year-1', teacherId: 'teacher-x' });

    expect(prisma.schoolClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          requirements: expect.objectContaining({
            where: expect.objectContaining({ assignment: { teacherId: 'teacher-x' } }),
          }),
        }),
      }),
    );
  });

  it('applique le filtre par salle en ne chargeant que cette salle', async () => {
    await service.generate('school-1', { academicYearId: 'year-1', roomId: 'room-x' });

    expect(prisma.room.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', isActive: true, id: 'room-x' },
      orderBy: { name: 'asc' },
    });
  });
});
