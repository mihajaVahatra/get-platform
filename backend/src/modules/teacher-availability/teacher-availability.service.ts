import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeclareUnavailabilityDto } from './dto/teacher-availability.dto';
import { SetTravelBufferDto } from './dto/teacher-travel-buffer.dto';

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

@Injectable()
export class TeacherAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTeacherByUserId(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Profil professeur introuvable');
    return teacher;
  }

  // ========== UNAVAILABILITY ==========

  async listMyUnavailability(teacherId: string) {
    return this.prisma.teacherAvailability.findMany({
      where: { teacherId },
      orderBy: [{ dayOfWeek: 'asc' }, { date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async declareUnavailability(teacherId: string, dto: DeclareUnavailabilityDto) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("L'heure de fin doit être postérieure à l'heure de début");
    }
    if (!dto.dayOfWeek && !dto.date) {
      throw new BadRequestException('Précisez un jour récurrent ou une date ponctuelle');
    }
    return this.prisma.teacherAvailability.create({
      data: {
        teacherId,
        dayOfWeek: dto.dayOfWeek,
        date: dto.date ? new Date(dto.date) : undefined,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });
  }

  async deleteUnavailability(teacherId: string, id: string) {
    const entry = await this.prisma.teacherAvailability.findFirst({ where: { id, teacherId } });
    if (!entry) throw new NotFoundException('Indisponibilité introuvable');
    await this.prisma.teacherAvailability.delete({ where: { id } });
    return { id };
  }

  // ========== TRAVEL BUFFERS ==========

  async listMyTravelBuffers(teacherId: string) {
    return this.prisma.teacherTravelBuffer.findMany({
      where: { teacherId },
      include: {
        schoolA: { select: { id: true, name: true } },
        schoolB: { select: { id: true, name: true } },
      },
    });
  }

  async setTravelBuffer(teacherId: string, dto: SetTravelBufferDto) {
    if (dto.schoolAId === dto.schoolBId) {
      throw new BadRequestException('Choisissez deux écoles différentes');
    }
    await this.assertActiveAssignment(teacherId, dto.schoolAId);
    await this.assertActiveAssignment(teacherId, dto.schoolBId);
    const [schoolAId, schoolBId] = [dto.schoolAId, dto.schoolBId].sort();

    return this.prisma.teacherTravelBuffer.upsert({
      where: { teacherId_schoolAId_schoolBId: { teacherId, schoolAId, schoolBId } },
      create: { teacherId, schoolAId, schoolBId, minutesBuffer: dto.minutesBuffer },
      update: { minutesBuffer: dto.minutesBuffer },
    });
  }

  async deleteTravelBuffer(teacherId: string, id: string) {
    const entry = await this.prisma.teacherTravelBuffer.findFirst({ where: { id, teacherId } });
    if (!entry) throw new NotFoundException('Temps de trajet introuvable');
    await this.prisma.teacherTravelBuffer.delete({ where: { id } });
    return { id };
  }

  private async assertActiveAssignment(teacherId: string, schoolId: string) {
    const assignment = await this.prisma.teacherSchool.findFirst({
      where: { teacherId, schoolId, isActive: true },
    });
    if (!assignment) {
      throw new BadRequestException("Le professeur n'est pas affecté à cette école");
    }
  }

  // ========== AVAILABILITY CHECK (used by SchoolService when creating/updating a slot) ==========

  async isTeacherFree(
    teacherId: string,
    schoolId: string,
    slot: { dayOfWeek: number; startTime: string; endTime: string },
    excludeSlotId?: string,
  ): Promise<boolean> {
    const range = { start: toMinutes(slot.startTime), end: toMinutes(slot.endTime) };

    const unavailability = await this.prisma.teacherAvailability.findMany({
      where: { teacherId, dayOfWeek: slot.dayOfWeek },
    });
    if (
      unavailability.some((entry) =>
        overlaps(range.start, range.end, toMinutes(entry.startTime), toMinutes(entry.endTime)),
      )
    ) {
      return false;
    }

    const existingSlots = await this.prisma.courseSlot.findMany({
      where: {
        teacherId,
        dayOfWeek: slot.dayOfWeek,
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      select: { startTime: true, endTime: true, course: { select: { schoolId: true } } },
    });
    if (
      existingSlots.some((existing) =>
        overlaps(range.start, range.end, toMinutes(existing.startTime), toMinutes(existing.endTime)),
      )
    ) {
      return false;
    }

    // Marge de trajet vis-à-vis des créneaux du même jour dans une AUTRE école.
    const otherSchoolSlots = existingSlots.filter((existing) => existing.course.schoolId !== schoolId);
    if (otherSchoolSlots.length > 0) {
      const otherSchoolIds = [...new Set(otherSchoolSlots.map((s) => s.course.schoolId))];
      const buffers = await this.prisma.teacherTravelBuffer.findMany({
        where: {
          teacherId,
          OR: otherSchoolIds.flatMap((otherId) => {
            const [a, b] = [schoolId, otherId].sort();
            return [{ schoolAId: a, schoolBId: b }];
          }),
        },
      });
      for (const existing of otherSchoolSlots) {
        const [a, b] = [schoolId, existing.course.schoolId].sort();
        const buffer = buffers.find((buf) => buf.schoolAId === a && buf.schoolBId === b);
        if (!buffer) continue;
        const gapBefore = range.start - toMinutes(existing.endTime);
        const gapAfter = toMinutes(existing.startTime) - range.end;
        const gap = gapBefore >= 0 ? gapBefore : gapAfter;
        if (gap < buffer.minutesBuffer) return false;
      }
    }

    return true;
  }

  async assertTeacherFreeOrThrow(
    teacherId: string,
    schoolId: string,
    slot: { dayOfWeek: number; startTime: string; endTime: string },
    excludeSlotId?: string,
  ) {
    const free = await this.isTeacherFree(teacherId, schoolId, slot, excludeSlotId);
    if (!free) {
      throw new BadRequestException(
        "Ce professeur n'est pas disponible sur ce créneau (indisponibilité déclarée, cours dans une autre école, ou temps de trajet insuffisant)",
      );
    }
  }

  translateExclusionConstraintError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientUnknownRequestError)) return null;
    if (!error.message.includes('no_teacher_double_booking')) return null;
    return new BadRequestException(
      "Ce professeur vient d'être réservé sur ce créneau par un autre établissement. Veuillez réessayer avec un autre horaire.",
    );
  }

  // ========== ADMIN_GET: teacher lookup + global conflict report ==========

  async searchTeachers(search?: string) {
    return this.prisma.teacher.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true } },
        assignments: { select: { school: { select: { name: true } } }, where: { isActive: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== ADMIN_GET: global conflict / travel-buffer report ==========

  async getConflictReport(teacherId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Professeur introuvable');

    const slots = await this.prisma.courseSlot.findMany({
      where: { teacherId },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        course: { select: { schoolId: true, school: { select: { name: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const buffers = await this.prisma.teacherTravelBuffer.findMany({ where: { teacherId } });

    const warnings: Array<{
      dayOfWeek: number;
      schoolA: string;
      timeA: string;
      schoolB: string;
      timeB: string;
      gapMinutes: number;
      requiredMinutes: number;
    }> = [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (a.dayOfWeek !== b.dayOfWeek) continue;
        if (a.course.schoolId === b.course.schoolId) continue;
        const [x, y] = toMinutes(a.startTime) <= toMinutes(b.startTime) ? [a, b] : [b, a];
        const gap = toMinutes(y.startTime) - toMinutes(x.endTime);
        const [schoolAId, schoolBId] = [x.course.schoolId, y.course.schoolId].sort();
        const buffer = buffers.find((buf) => buf.schoolAId === schoolAId && buf.schoolBId === schoolBId);
        const required = buffer?.minutesBuffer ?? 0;
        if (gap < required) {
          warnings.push({
            dayOfWeek: x.dayOfWeek,
            schoolA: x.course.school.name,
            timeA: `${x.startTime}–${x.endTime}`,
            schoolB: y.course.school.name,
            timeB: `${y.startTime}–${y.endTime}`,
            gapMinutes: gap,
            requiredMinutes: required,
          });
        }
      }
    }

    return {
      teacherId,
      schoolCount: new Set(slots.map((s) => s.course.schoolId)).size,
      warnings,
    };
  }
}
