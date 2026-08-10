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

/**
 * Fondations du moteur de planification (Phase 1) : gère les salles, les classes,
 * les besoins horaires par matière (SubjectRequirement) et leur affectation à un
 * professeur, ainsi que la grille de créneaux-types (SchoolTimeSlot) de l'école.
 * Toutes les opérations sont scopées par schoolId afin qu'une école ne puisse
 * jamais lire ni modifier les données d'une autre école.
 */
@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== ROOMS ==========

  /**
   * Liste les salles d'une école, triées par nom.
   * @param schoolId Identifiant de l'école (scope de sécurité).
   * @returns La liste des salles (Room) de l'école.
   */
  async listRooms(schoolId: string) {
    return this.prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Crée une nouvelle salle pour l'école.
   * Vérifie au préalable qu'aucune autre salle de l'école ne porte déjà ce nom.
   * @param schoolId Identifiant de l'école.
   * @param dto Données de la salle à créer (nom, capacité, type, statut actif).
   * @returns La salle créée.
   * @throws BadRequestException si le nom est déjà utilisé par une autre salle de l'école.
   */
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

  /**
   * Met à jour une salle existante.
   * Si le nom change, revérifie sa disponibilité au sein de l'école.
   * @param schoolId Identifiant de l'école.
   * @param roomId Identifiant de la salle à modifier.
   * @param dto Champs à mettre à jour.
   * @returns La salle mise à jour.
   * @throws NotFoundException si la salle n'existe pas pour cette école.
   * @throws BadRequestException si le nouveau nom est déjà pris.
   */
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

  /**
   * Supprime une salle de l'école.
   * @param schoolId Identifiant de l'école.
   * @param roomId Identifiant de la salle à supprimer.
   * @returns L'identifiant de la salle supprimée.
   * @throws NotFoundException si la salle n'existe pas pour cette école.
   */
  async deleteRoom(schoolId: string, roomId: string) {
    await this.ensureRoom(schoolId, roomId);
    await this.prisma.room.delete({ where: { id: roomId } });
    return { id: roomId };
  }

  /**
   * Récupère une salle en s'assurant qu'elle appartient bien à l'école donnée.
   * @param schoolId Identifiant de l'école (scope de sécurité).
   * @param roomId Identifiant de la salle recherchée.
   * @returns La salle trouvée.
   * @throws NotFoundException si aucune salle ne correspond dans cette école.
   */
  private async ensureRoom(schoolId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, schoolId } });
    if (!room) throw new NotFoundException('Salle introuvable');
    return room;
  }

  /**
   * Vérifie qu'aucune salle de l'école ne porte déjà ce nom (le nom est unique par école).
   * @param schoolId Identifiant de l'école.
   * @param name Nom candidat (comparé après trim).
   * @throws BadRequestException si le nom est déjà utilisé.
   */
  private async assertRoomNameAvailable(schoolId: string, name: string) {
    const existing = await this.prisma.room.findFirst({
      where: { schoolId, name: name.trim() },
    });
    if (existing) throw new BadRequestException('Une salle porte déjà ce nom');
  }

  // ========== SCHOOL TIME SLOTS ==========

  /**
   * Liste les créneaux-types de l'école, triés par jour puis par heure de début.
   * @param schoolId Identifiant de l'école.
   * @returns La liste des créneaux-types (SchoolTimeSlot).
   */
  async listTimeSlots(schoolId: string) {
    return this.prisma.schoolTimeSlot.findMany({
      where: { schoolId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Crée un nouveau créneau-type pour l'école.
   * Valide la cohérence des heures puis l'absence de chevauchement avec un
   * créneau existant sur le même jour.
   * @param schoolId Identifiant de l'école.
   * @param dto Données du créneau (jour, heures de début/fin, libellé, statut actif).
   * @returns Le créneau créé.
   * @throws BadRequestException si l'heure de fin précède l'heure de début, ou en cas de chevauchement.
   */
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

  /**
   * Met à jour un créneau-type existant.
   * Reconstruit une version candidate (valeurs modifiées fusionnées avec les valeurs
   * actuelles) pour revalider l'ordre des heures et l'absence de chevauchement,
   * en excluant le créneau lui-même de la recherche de conflit.
   * @param schoolId Identifiant de l'école.
   * @param slotId Identifiant du créneau à modifier.
   * @param dto Champs à mettre à jour.
   * @returns Le créneau mis à jour.
   * @throws NotFoundException si le créneau n'existe pas pour cette école.
   * @throws BadRequestException si les heures deviennent incohérentes ou chevauchent un autre créneau.
   */
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

  /**
   * Supprime un créneau-type de l'école.
   * @param schoolId Identifiant de l'école.
   * @param slotId Identifiant du créneau à supprimer.
   * @returns L'identifiant du créneau supprimé.
   * @throws NotFoundException si le créneau n'existe pas pour cette école.
   */
  async deleteTimeSlot(schoolId: string, slotId: string) {
    await this.ensureTimeSlot(schoolId, slotId);
    await this.prisma.schoolTimeSlot.delete({ where: { id: slotId } });
    return { id: slotId };
  }

  /**
   * Récupère un créneau-type en s'assurant qu'il appartient à l'école donnée.
   * @param schoolId Identifiant de l'école.
   * @param slotId Identifiant du créneau recherché.
   * @returns Le créneau trouvé.
   * @throws NotFoundException si aucun créneau ne correspond dans cette école.
   */
  private async ensureTimeSlot(schoolId: string, slotId: string) {
    const slot = await this.prisma.schoolTimeSlot.findFirst({
      where: { id: slotId, schoolId },
    });
    if (!slot) throw new NotFoundException('Créneau introuvable');
    return slot;
  }

  /**
   * Vérifie qu'un intervalle horaire est cohérent (fin strictement après début).
   * @param startTime Heure de début au format "HH:mm".
   * @param endTime Heure de fin au format "HH:mm".
   * @throws BadRequestException si l'heure de fin n'est pas postérieure à l'heure de début.
   */
  private assertTimeOrder(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        "L'heure de fin doit être postérieure à l'heure de début",
      );
    }
  }

  /**
   * Vérifie qu'aucun créneau-type existant de l'école ne chevauche le créneau candidat
   * sur le même jour.
   * @param schoolId Identifiant de l'école.
   * @param slot Créneau candidat (jour, heure de début, heure de fin).
   * @param excludedSlotId Identifiant à exclure de la recherche (utile lors d'une mise à jour, pour ne pas comparer le créneau à lui-même).
   * @throws BadRequestException si un chevauchement est détecté.
   */
  private async assertNoTimeSlotOverlap(
    schoolId: string,
    slot: { dayOfWeek: number; startTime: string; endTime: string },
    excludedSlotId?: string,
  ) {
    const conflict = await this.prisma.schoolTimeSlot.findFirst({
      where: {
        schoolId,
        dayOfWeek: slot.dayOfWeek,
        // Chevauchement d'intervalles : le candidat commence avant la fin de
        // l'existant ET finit après le début de l'existant.
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

  /**
   * Liste les classes de l'école avec leurs relations utiles à la planification :
   * année scolaire, filière, besoins horaires par matière et professeur affecté.
   * @param schoolId Identifiant de l'école.
   * @returns La liste des classes (SchoolClass), triées par année scolaire décroissante puis par nom.
   */
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

  /**
   * Crée une nouvelle classe pour l'école.
   * Vérifie l'existence de l'année scolaire, l'appartenance de la filière à l'école
   * (si fournie) et l'unicité du nom de classe au sein de l'année scolaire.
   * @param schoolId Identifiant de l'école.
   * @param dto Données de la classe à créer.
   * @returns La classe créée.
   * @throws BadRequestException si l'année scolaire est introuvable, la filière n'appartient pas à l'école, ou le nom est déjà utilisé pour cette année.
   */
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

  /**
   * Met à jour une classe existante.
   * Revalide l'année scolaire et la filière si elles sont modifiées, et
   * l'unicité du nom si celui-ci change.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe à modifier.
   * @param dto Champs à mettre à jour.
   * @returns La classe mise à jour.
   * @throws NotFoundException si la classe n'existe pas pour cette école.
   * @throws BadRequestException si l'année scolaire/la filière sont invalides ou si le nom est déjà pris.
   */
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

  /**
   * Supprime une classe de l'école.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe à supprimer.
   * @returns L'identifiant de la classe supprimée.
   * @throws NotFoundException si la classe n'existe pas pour cette école.
   */
  async deleteClass(schoolId: string, classId: string) {
    await this.ensureClass(schoolId, classId);
    await this.prisma.schoolClass.delete({ where: { id: classId } });
    return { id: classId };
  }

  /**
   * Récupère une classe en s'assurant qu'elle appartient à l'école donnée.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe recherchée.
   * @returns La classe trouvée.
   * @throws NotFoundException si aucune classe ne correspond dans cette école.
   */
  private async ensureClass(schoolId: string, classId: string) {
    const schoolClass = await this.prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
    });
    if (!schoolClass) throw new NotFoundException('Classe introuvable');
    return schoolClass;
  }

  /**
   * Vérifie qu'aucune classe de l'école ne porte déjà ce nom pour l'année scolaire donnée
   * (le nom est unique par école ET par année scolaire, pas globalement).
   * @param schoolId Identifiant de l'école.
   * @param academicYearId Année scolaire concernée.
   * @param name Nom candidat (comparé après trim).
   * @throws BadRequestException si le nom est déjà utilisé pour cette année scolaire.
   */
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

  /**
   * Vérifie que la filière (SchoolProgram) appartient bien à l'école donnée.
   * @param schoolId Identifiant de l'école.
   * @param programId Identifiant de la filière à vérifier.
   * @throws BadRequestException si la filière n'existe pas pour cette école.
   */
  private async assertProgramBelongsToSchool(schoolId: string, programId: string) {
    const program = await this.prisma.schoolProgram.findFirst({
      where: { id: programId, schoolId },
    });
    if (!program) throw new BadRequestException('Filière introuvable pour cette école');
  }

  /**
   * Vérifie que l'année scolaire existe (recherche globale, non scopée par école :
   * les années scolaires sont une entité partagée entre écoles).
   * @param academicYearId Identifiant de l'année scolaire.
   * @throws BadRequestException si l'année scolaire est introuvable.
   */
  private async assertAcademicYearExists(academicYearId: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) throw new BadRequestException('Année scolaire introuvable');
  }

  // ========== SUBJECT REQUIREMENTS ==========

  /**
   * Crée un besoin horaire (SubjectRequirement) pour une matière d'une classe,
   * c'est-à-dire le nombre d'heures hebdomadaires à planifier pour cette matière.
   * Vérifie que la classe existe, que la matière appartient à l'école, que l'année
   * scolaire existe, et qu'aucun besoin n'est déjà défini pour ce couple classe/matière
   * (une seule ligne de besoin horaire possible par matière et par classe, via la
   * contrainte d'unicité classId_subjectId).
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe concernée.
   * @param dto Données du besoin horaire (matière, année scolaire, heures/semaine).
   * @returns Le besoin horaire créé.
   * @throws BadRequestException si la matière/l'année scolaire sont invalides ou si un besoin existe déjà pour cette matière.
   */
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

  /**
   * Met à jour un besoin horaire existant (par exemple le nombre d'heures/semaine).
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe.
   * @param requirementId Identifiant du besoin horaire à modifier.
   * @param dto Champs à mettre à jour.
   * @returns Le besoin horaire mis à jour.
   * @throws NotFoundException si le besoin horaire n'existe pas pour cette classe/école.
   */
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

  /**
   * Supprime un besoin horaire.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe.
   * @param requirementId Identifiant du besoin horaire à supprimer.
   * @returns L'identifiant du besoin horaire supprimé.
   * @throws NotFoundException si le besoin horaire n'existe pas pour cette classe/école.
   */
  async deleteRequirement(schoolId: string, classId: string, requirementId: string) {
    await this.ensureRequirement(schoolId, classId, requirementId);
    await this.prisma.subjectRequirement.delete({ where: { id: requirementId } });
    return { id: requirementId };
  }

  /**
   * Affecte un professeur à un besoin horaire (une matière d'une classe).
   * Vérifie au préalable que le professeur est bien déclaré qualifié pour cette
   * matière dans cette école. Un besoin horaire n'a qu'un seul professeur affecté :
   * l'upsert remplace l'affectation existante s'il y en avait déjà une.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe.
   * @param requirementId Identifiant du besoin horaire.
   * @param dto Contient l'identifiant du professeur à affecter.
   * @returns L'affectation (TeacherAssignment) créée ou mise à jour.
   * @throws NotFoundException si le besoin horaire n'existe pas.
   * @throws BadRequestException si le professeur n'est pas qualifié pour la matière dans cette école.
   */
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

  /**
   * Retire l'affectation de professeur d'un besoin horaire.
   * L'absence d'affectation existante n'est pas considérée comme une erreur :
   * le `.catch(() => null)` absorbe l'exception levée si aucune affectation
   * n'était présente pour ce besoin horaire.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe.
   * @param requirementId Identifiant du besoin horaire.
   * @returns L'identifiant du besoin horaire concerné.
   * @throws NotFoundException si le besoin horaire n'existe pas pour cette classe/école.
   */
  async unassignTeacher(schoolId: string, classId: string, requirementId: string) {
    await this.ensureRequirement(schoolId, classId, requirementId);
    await this.prisma.teacherAssignment
      .delete({ where: { subjectRequirementId: requirementId } })
      .catch(() => null);
    return { id: requirementId };
  }

  /**
   * Récupère un besoin horaire en s'assurant qu'il appartient à la classe et à l'école données.
   * @param schoolId Identifiant de l'école.
   * @param classId Identifiant de la classe.
   * @param requirementId Identifiant du besoin horaire recherché.
   * @returns Le besoin horaire trouvé.
   * @throws NotFoundException si aucun besoin horaire ne correspond.
   */
  private async ensureRequirement(schoolId: string, classId: string, requirementId: string) {
    const requirement = await this.prisma.subjectRequirement.findFirst({
      where: { id: requirementId, classId, schoolId },
    });
    if (!requirement) throw new NotFoundException('Besoin horaire introuvable');
    return requirement;
  }

  /**
   * Vérifie que la matière (SchoolSubject) appartient bien à l'école donnée.
   * @param schoolId Identifiant de l'école.
   * @param subjectId Identifiant de la matière à vérifier.
   * @throws BadRequestException si la matière n'existe pas pour cette école.
   */
  private async assertSubjectBelongsToSchool(schoolId: string, subjectId: string) {
    const subject = await this.prisma.schoolSubject.findFirst({
      where: { id: subjectId, schoolId },
    });
    if (!subject) throw new BadRequestException('Matière introuvable pour cette école');
  }

  /**
   * Vérifie que le professeur est déclaré qualifié pour enseigner cette matière
   * dans cette école, via une relation TeacherSchoolSubject rattachée à une
   * relation TeacherSchool active (isActive: true).
   * @param schoolId Identifiant de l'école.
   * @param teacherId Identifiant du professeur.
   * @param subjectId Identifiant de la matière.
   * @throws BadRequestException si aucune qualification active n'est trouvée.
   */
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
