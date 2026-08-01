import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { CreateSchoolClassDto, UpdateSchoolClassDto } from './dto/school-class.dto';
import {
  AssignTeacherToRequirementDto,
  CreateSubjectRequirementDto,
  UpdateSubjectRequirementDto,
} from './dto/subject-requirement.dto';
import {
  CreateSchoolTimeSlotDto,
  UpdateSchoolTimeSlotDto,
} from './dto/school-time-slot.dto';

/// Fondations du moteur de planification (Phase 1) : salles, classes,
/// besoins horaires par matière, affectation prof, grille de créneaux-type.
/// Tout est scopé par schoolId — jamais de fuite d'une autre école.
@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== ROOMS ==========

  async listRooms(schoolId: string) {
    return this.prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async createRoom(schoolId: string, dto: CreateRoomDto) {
    await this.assertRoomNameAvailable(schoolId, dto.name);
    return this.prisma.room.create({
      data: {
        schoolId,
        name: dto.name.trim(),
        capacity: dto.capacity,
        type: dto.type ?? 'STANDARD',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateRoom(schoolId: string, roomId: string, dto: UpdateRoomDto) {
    const room = await this.ensureRoom(schoolId, roomId);
    if (dto.name && dto.name.trim() !== room.name) {
      await this.assertRoomNameAvailable(schoolId, dto.name);
    }
    return this.prisma.room.update({
      where: { id: roomId },
      data: { ...dto, name: dto.name?.trim() },
    });
  }

  async deleteRoom(schoolId: string, roomId: string) {
    await this.ensureRoom(schoolId, roomId);
    await this.prisma.room.delete({ where: { id: roomId } });
    return { id: roomId };
  }

  private async ensureRoom(schoolId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, schoolId } });
    if (!room) throw new NotFoundException('Salle introuvable');
    return room;
  }

  private async assertRoomNameAvailable(schoolId: string, name: string) {
    const existing = await this.prisma.room.findFirst({
      where: { schoolId, name: name.trim() },
    });
    if (existing) throw new BadRequestException('Une salle porte déjà ce nom');
  }

  // ========== SCHOOL TIME SLOTS ==========

  async listTimeSlots(schoolId: string) {
    return this.prisma.schoolTimeSlot.findMany({
      where: { schoolId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createTimeSlot(schoolId: string, dto: CreateSchoolTimeSlotDto) {
    this.assertTimeOrder(dto.startTime, dto.endTime);
    await this.assertNoTimeSlotOverlap(schoolId, dto);
    return this.prisma.schoolTimeSlot.create({
      data: {
        schoolId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        label: dto.label,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTimeSlot(schoolId: string, slotId: string, dto: UpdateSchoolTimeSlotDto) {
    const slot = await this.ensureTimeSlot(schoolId, slotId);
    const candidate = {
      dayOfWeek: dto.dayOfWeek ?? slot.dayOfWeek,
      startTime: dto.startTime ?? slot.startTime,
      endTime: dto.endTime ?? slot.endTime,
    };
    this.assertTimeOrder(candidate.startTime, candidate.endTime);
    await this.assertNoTimeSlotOverlap(schoolId, candidate, slotId);
    return this.prisma.schoolTimeSlot.update({ where: { id: slotId }, data: dto });
  }

  async deleteTimeSlot(schoolId: string, slotId: string) {
    await this.ensureTimeSlot(schoolId, slotId);
    await this.prisma.schoolTimeSlot.delete({ where: { id: slotId } });
    return { id: slotId };
  }

  private async ensureTimeSlot(schoolId: string, slotId: string) {
    const slot = await this.prisma.schoolTimeSlot.findFirst({
      where: { id: slotId, schoolId },
    });
    if (!slot) throw new NotFoundException('Créneau introuvable');
    return slot;
  }

  private assertTimeOrder(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        "L'heure de fin doit être postérieure à l'heure de début",
      );
    }
  }

  private async assertNoTimeSlotOverlap(
    schoolId: string,
    slot: { dayOfWeek: number; startTime: string; endTime: string },
    excludedSlotId?: string,
  ) {
    const conflict = await this.prisma.schoolTimeSlot.findFirst({
      where: {
        schoolId,
        dayOfWeek: slot.dayOfWeek,
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
        ...(excludedSlotId ? { id: { not: excludedSlotId } } : {}),
      },
    });
    if (conflict) {
      throw new BadRequestException('Ce créneau chevauche un créneau-type existant');
    }
  }

  // ========== SCHOOL CLASSES ==========

  async listClasses(schoolId: string) {
    return this.prisma.schoolClass.findMany({
      where: { schoolId },
      include: {
        academicYear: { select: { id: true, label: true } },
        program: { select: { id: true, name: true } },
        requirements: {
          include: {
            subject: { select: { id: true, name: true } },
            assignment: {
              include: {
                teacher: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    user: { select: { email: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ academicYearId: 'desc' }, { name: 'asc' }],
    });
  }

  async createClass(schoolId: string, dto: CreateSchoolClassDto) {
    await this.assertAcademicYearExists(dto.academicYearId);
    if (dto.programId) await this.assertProgramBelongsToSchool(schoolId, dto.programId);
    await this.assertClassNameAvailable(schoolId, dto.academicYearId, dto.name);

    return this.prisma.schoolClass.create({
      data: {
        schoolId,
        academicYearId: dto.academicYearId,
        programId: dto.programId,
        name: dto.name.trim(),
        level: dto.level,
        studentCount: dto.studentCount,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateClass(schoolId: string, classId: string, dto: UpdateSchoolClassDto) {
    const schoolClass = await this.ensureClass(schoolId, classId);
    if (dto.academicYearId) await this.assertAcademicYearExists(dto.academicYearId);
    if (dto.programId) await this.assertProgramBelongsToSchool(schoolId, dto.programId);
    if (dto.name && dto.name.trim() !== schoolClass.name) {
      await this.assertClassNameAvailable(
        schoolId,
        dto.academicYearId ?? schoolClass.academicYearId,
        dto.name,
      );
    }
    return this.prisma.schoolClass.update({
      where: { id: classId },
      data: { ...dto, name: dto.name?.trim() },
    });
  }

  async deleteClass(schoolId: string, classId: string) {
    await this.ensureClass(schoolId, classId);
    await this.prisma.schoolClass.delete({ where: { id: classId } });
    return { id: classId };
  }

  private async ensureClass(schoolId: string, classId: string) {
    const schoolClass = await this.prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
    });
    if (!schoolClass) throw new NotFoundException('Classe introuvable');
    return schoolClass;
  }

  private async assertClassNameAvailable(
    schoolId: string,
    academicYearId: string,
    name: string,
  ) {
    const existing = await this.prisma.schoolClass.findFirst({
      where: { schoolId, academicYearId, name: name.trim() },
    });
    if (existing) {
      throw new BadRequestException(
        'Une classe porte déjà ce nom pour cette année scolaire',
      );
    }
  }

  private async assertProgramBelongsToSchool(schoolId: string, programId: string) {
    const program = await this.prisma.schoolProgram.findFirst({
      where: { id: programId, schoolId },
    });
    if (!program) throw new BadRequestException('Filière introuvable pour cette école');
  }

  private async assertAcademicYearExists(academicYearId: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) throw new BadRequestException('Année scolaire introuvable');
  }

  // ========== SUBJECT REQUIREMENTS ==========

  async createRequirement(
    schoolId: string,
    classId: string,
    dto: CreateSubjectRequirementDto,
  ) {
    await this.ensureClass(schoolId, classId);
    await this.assertSubjectBelongsToSchool(schoolId, dto.subjectId);
    await this.assertAcademicYearExists(dto.academicYearId);

    const existing = await this.prisma.subjectRequirement.findUnique({
      where: { classId_subjectId: { classId, subjectId: dto.subjectId } },
    });
    if (existing) {
      throw new BadRequestException('Cette matière est déjà définie pour cette classe');
    }

    return this.prisma.subjectRequirement.create({
      data: {
        schoolId,
        classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        hoursPerWeek: dto.hoursPerWeek,
      },
    });
  }

  async updateRequirement(
    schoolId: string,
    classId: string,
    requirementId: string,
    dto: UpdateSubjectRequirementDto,
  ) {
    await this.ensureRequirement(schoolId, classId, requirementId);
    return this.prisma.subjectRequirement.update({
      where: { id: requirementId },
      data: dto,
    });
  }

  async deleteRequirement(schoolId: string, classId: string, requirementId: string) {
    await this.ensureRequirement(schoolId, classId, requirementId);
    await this.prisma.subjectRequirement.delete({ where: { id: requirementId } });
    return { id: requirementId };
  }

  async assignTeacher(
    schoolId: string,
    classId: string,
    requirementId: string,
    dto: AssignTeacherToRequirementDto,
  ) {
    const requirement = await this.ensureRequirement(schoolId, classId, requirementId);
    await this.assertTeacherQualified(schoolId, dto.teacherId, requirement.subjectId);

    return this.prisma.teacherAssignment.upsert({
      where: { subjectRequirementId: requirementId },
      create: { subjectRequirementId: requirementId, teacherId: dto.teacherId },
      update: { teacherId: dto.teacherId },
    });
  }

  async unassignTeacher(schoolId: string, classId: string, requirementId: string) {
    await this.ensureRequirement(schoolId, classId, requirementId);
    await this.prisma.teacherAssignment
      .delete({ where: { subjectRequirementId: requirementId } })
      .catch(() => null);
    return { id: requirementId };
  }

  private async ensureRequirement(schoolId: string, classId: string, requirementId: string) {
    const requirement = await this.prisma.subjectRequirement.findFirst({
      where: { id: requirementId, classId, schoolId },
    });
    if (!requirement) throw new NotFoundException('Besoin horaire introuvable');
    return requirement;
  }

  private async assertSubjectBelongsToSchool(schoolId: string, subjectId: string) {
    const subject = await this.prisma.schoolSubject.findFirst({
      where: { id: subjectId, schoolId },
    });
    if (!subject) throw new BadRequestException('Matière introuvable pour cette école');
  }

  private async assertTeacherQualified(schoolId: string, teacherId: string, subjectId: string) {
    const qualification = await this.prisma.teacherSchoolSubject.findFirst({
      where: {
        subjectId,
        teacherSchool: { schoolId, teacherId, isActive: true },
      },
    });
    if (!qualification) {
      throw new BadRequestException(
        "Ce professeur n'est pas déclaré qualifié pour cette matière dans votre école",
      );
    }
  }
}
