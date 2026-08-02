import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from './school.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export type UnresolvedItem = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherName: string | null;
  hoursPerWeek: number;
  sessionsPlaced: number;
  sessionsNeeded: number;
  reason: string;
};

type CandidateSlot = { dayOfWeek: number; startTime: string; endTime: string };

/// Génération automatique du planning (Phase 3) : pour chaque besoin horaire
/// (SubjectRequirement) affecté à un prof, place le nombre de séances
/// nécessaires dans les créneaux-types/salles libres de l'école, en
/// réutilisant les vérifications déjà posées en Phase 2 (disponibilité prof,
/// conflit de salle) via SchoolService.createCourse/createCourseSlot — cette
/// méthode ne duplique que la vérification manquante : qu'une même classe ne
/// se retrouve pas avec deux séances en même temps (Course n'a pas de lien
/// direct vers SchoolClass, seulement via subjectRequirement.classId).
@Injectable()
export class ScheduleGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolService: SchoolService,
  ) {}

  async generate(schoolId: string, dto: GenerateScheduleDto) {
    const [timeSlots, rooms] = await Promise.all([
      this.prisma.schoolTimeSlot.findMany({
        where: { schoolId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.room.findMany({
        where: {
          schoolId,
          isActive: true,
          ...(dto.roomId ? { id: dto.roomId } : {}),
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const classes = await this.prisma.schoolClass.findMany({
      where: {
        schoolId,
        academicYearId: dto.academicYearId,
        ...(dto.classId ? { id: dto.classId } : {}),
      },
      include: {
        program: true,
        requirements: {
          where: {
            ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
            ...(dto.teacherId ? { assignment: { teacherId: dto.teacherId } } : {}),
          },
          include: {
            subject: true,
            assignment: { include: { teacher: true } },
            course: { include: { slots: true } },
          },
        },
      },
    });

    const typicalDurationMinutes = timeSlots.length
      ? Math.round(
          timeSlots.reduce(
            (sum, slot) => sum + (toMinutes(slot.endTime) - toMinutes(slot.startTime)),
            0,
          ) / timeSlots.length,
        )
      : 0;

    type Job = (typeof classes)[number]['requirements'][number] & {
      schoolClass: (typeof classes)[number];
    };
    const jobs: Job[] = [];
    for (const schoolClass of classes) {
      for (const requirement of schoolClass.requirements) {
        jobs.push({ ...requirement, schoolClass });
      }
    }
    jobs.sort(
      (a, b) =>
        b.hoursPerWeek - a.hoursPerWeek ||
        a.schoolClass.name.localeCompare(b.schoolClass.name) ||
        a.subject.name.localeCompare(b.subject.name),
    );

    const unresolved: UnresolvedItem[] = [];
    let createdSlots = 0;
    // Combinaisons déjà utilisées PENDANT ce run (les séances déjà en base
    // sont déjà couvertes par isTeacherFree/ensureNoRoomConflict/isClassBusy).
    const usedTeacherSlots = new Set<string>();
    const usedRoomSlots = new Set<string>();

    const baseUnresolved = (job: Job, sessionsPlaced: number, reason: string): UnresolvedItem => ({
      classId: job.schoolClass.id,
      className: job.schoolClass.name,
      subjectId: job.subjectId,
      subjectName: job.subject.name,
      teacherName: job.assignment
        ? job.assignment.teacher.firstName || job.assignment.teacher.lastName
          ? `${job.assignment.teacher.firstName ?? ''} ${job.assignment.teacher.lastName ?? ''}`.trim()
          : null
        : null,
      hoursPerWeek: job.hoursPerWeek,
      sessionsPlaced,
      sessionsNeeded: this.sessionsNeededFor(job.hoursPerWeek, typicalDurationMinutes),
      reason,
    });

    for (const job of jobs) {
      if (!job.assignment) {
        unresolved.push(baseUnresolved(job, 0, 'Aucun professeur affecté'));
        continue;
      }
      if (!job.schoolClass.programId || !job.schoolClass.program) {
        unresolved.push(baseUnresolved(job, 0, 'Classe sans filière associée'));
        continue;
      }
      if (timeSlots.length === 0 || rooms.length === 0 || typicalDurationMinutes <= 0) {
        unresolved.push(
          baseUnresolved(job, 0, 'Aucun créneau-type ou salle active configuré pour cette école'),
        );
        continue;
      }

      const teacherId = job.assignment.teacherId;
      const sessionsNeeded = this.sessionsNeededFor(job.hoursPerWeek, typicalDurationMinutes);
      const existingSessions = job.course?.slots.length ?? 0;
      const sessionsToPlace = sessionsNeeded - existingSessions;
      if (sessionsToPlace <= 0) continue; // déjà entièrement planifié (idempotence)

      let courseId = job.course?.id ?? null;
      if (!courseId) {
        try {
          const created = await this.schoolService.createCourse(schoolId, {
            teacherId,
            code: `AUTO-${job.id.slice(0, 8).toUpperCase()}`,
            subjectId: job.subjectId,
            programId: job.schoolClass.programId,
            programLevel: job.schoolClass.level ?? 1,
            isPublished: true,
          });
          await this.prisma.course.update({
            where: { id: created.id },
            data: { subjectRequirementId: job.id },
          });
          courseId = created.id;
        } catch (error) {
          const message = error instanceof BadRequestException ? error.message : 'Erreur';
          unresolved.push(baseUnresolved(job, 0, `Cours impossible à créer : ${message}`));
          continue;
        }
      }

      let placed = 0;
      for (const timeSlot of timeSlots) {
        if (placed >= sessionsToPlace) break;
        const slotKey: CandidateSlot = {
          dayOfWeek: timeSlot.dayOfWeek,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
        };
        if (usedTeacherSlots.has(this.comboKey(teacherId, slotKey))) continue;
        if (await this.isClassBusy(job.schoolClass.id, slotKey)) continue;

        for (const room of rooms) {
          if (placed >= sessionsToPlace) break;
          if (usedRoomSlots.has(this.comboKey(room.name, slotKey))) continue;

          try {
            await this.schoolService.createCourseSlot(schoolId, courseId, {
              ...slotKey,
              room: room.name,
            });
            usedTeacherSlots.add(this.comboKey(teacherId, slotKey));
            usedRoomSlots.add(this.comboKey(room.name, slotKey));
            placed++;
            createdSlots++;
            break;
          } catch {
            // Prof indisponible / salle occupée / conflit détecté en base : on essaie la salle suivante.
            continue;
          }
        }
      }

      if (placed < sessionsToPlace) {
        unresolved.push(
          baseUnresolved(
            job,
            existingSessions + placed,
            'Aucun créneau libre compatible (disponibilité prof / salle / classe)',
          ),
        );
      }
    }

    return { createdSlots, unresolved };
  }

  private sessionsNeededFor(hoursPerWeek: number, typicalDurationMinutes: number) {
    if (typicalDurationMinutes <= 0) return 1;
    return Math.max(1, Math.round((hoursPerWeek * 60) / typicalDurationMinutes));
  }

  private comboKey(entityKey: string, slot: CandidateSlot) {
    return `${entityKey}|${slot.dayOfWeek}|${slot.startTime}`;
  }

  private async isClassBusy(classId: string, slot: CandidateSlot) {
    const conflict = await this.prisma.courseSlot.findFirst({
      where: {
        dayOfWeek: slot.dayOfWeek,
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
        course: { subjectRequirement: { classId } },
      },
    });
    return !!conflict;
  }
}
