import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from './school.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';

/**
 * Convertit une heure au format "HH:mm" en nombre de minutes depuis minuit.
 * Utilisé pour calculer des durées de créneaux par simple soustraction.
 * @param time Heure au format "HH:mm".
 * @returns Le nombre de minutes écoulées depuis 00:00.
 */
function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Représente un besoin horaire (matière d'une classe) que la génération
 * automatique n'a pas réussi à planifier entièrement, avec le nombre de
 * séances effectivement placées, le nombre attendu, et la raison de l'échec.
 */
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

/** Créneau candidat pour une séance : jour de la semaine et plage horaire. */
type CandidateSlot = { dayOfWeek: number; startTime: string; endTime: string };

/**
 * Génération automatique du planning (Phase 3) : pour chaque besoin horaire
 * (SubjectRequirement) affecté à un professeur, place le nombre de séances
 * nécessaires dans les créneaux-types et salles libres de l'école, en
 * réutilisant les vérifications déjà posées en Phase 2 (disponibilité du
 * professeur, conflit de salle) via SchoolService.createCourse /
 * SchoolService.createCourseSlot. Cette classe ne duplique que la
 * vérification manquante à ce niveau : s'assurer qu'une même classe ne se
 * retrouve pas avec deux séances au même moment (l'entité Course n'a pas de
 * lien direct vers SchoolClass, seulement via subjectRequirement.classId).
 */
@Injectable()
export class ScheduleGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolService: SchoolService,
  ) {}

  /**
   * Génère automatiquement les séances de cours manquantes pour une école.
   *
   * Algorithme :
   * 1. Charge les créneaux-types actifs et les salles actives (filtrables par dto.roomId),
   *    ainsi que les classes de l'année scolaire ciblée (filtrables par dto.classId) avec
   *    leurs besoins horaires (filtrables par dto.subjectId / dto.teacherId).
   * 2. Calcule une durée « typique » de créneau (moyenne des durées de tous les créneaux-types)
   *    pour convertir des heures/semaine en nombre de séances à placer.
   * 3. Construit la liste des « jobs » (un job = un besoin horaire d'une classe) et les trie
   *    par heures/semaine décroissantes — les besoins les plus lourds, donc les plus
   *    contraints à placer, passent en premier — puis par nom de classe puis de matière
   *    pour un ordre stable et déterministe.
   * 4. Pour chaque job : ignore les besoins sans professeur affecté ou sans filière sur la
   *    classe, ou si l'école n'a aucun créneau-type/salle actif exploitable. Crée le Course
   *    associé s'il n'existe pas encore (idempotence : un job déjà entièrement planifié via
   *    ses course.slots existants n'est pas retraité). Tente ensuite de placer les séances
   *    manquantes en parcourant les créneaux-types puis les salles, en évitant les combinaisons
   *    déjà utilisées PENDANT ce run (usedTeacherSlots / usedRoomSlots) et en vérifiant que la
   *    classe n'est pas déjà occupée sur ce créneau (isClassBusy). La disponibilité du
   *    professeur et l'absence de conflit de salle en base sont déléguées à
   *    SchoolService.createCourseSlot, qui lève une exception en cas de conflit — la salle
   *    suivante est alors essayée.
   * 5. Les besoins pour lesquels toutes les séances n'ont pas pu être placées sont remontés
   *    dans `unresolved` avec la raison de l'échec.
   *
   * Effets de bord : crée des Course et des CourseSlot en base de données.
   * @param schoolId Identifiant de l'école.
   * @param dto Filtres optionnels (classe, matière, professeur, salle) et année scolaire ciblée.
   * @returns Le nombre de séances créées (`createdSlots`) et la liste des besoins non entièrement planifiés (`unresolved`).
   */
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
    // Priorité aux besoins les plus lourds en heures/semaine : ce sont les plus
    // contraints en nombre de séances à caser, donc on les place en premier.
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
      // Nom complet affiché si prénom ou nom est renseigné, sinon null (pas de professeur
      // affecté, ou professeur sans identité renseignée).
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
            // Code de cours généré automatiquement à partir de l'id du besoin horaire.
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

  /**
   * Calcule le nombre de séances nécessaires pour couvrir un volume d'heures
   * hebdomadaires, en fonction de la durée typique d'une séance.
   * Arrondit au plus proche et impose un minimum d'une séance.
   * @param hoursPerWeek Nombre d'heures hebdomadaires requises pour la matière.
   * @param typicalDurationMinutes Durée moyenne d'un créneau-type, en minutes.
   * @returns Le nombre de séances à planifier (au moins 1).
   */
  private sessionsNeededFor(hoursPerWeek: number, typicalDurationMinutes: number) {
    if (typicalDurationMinutes <= 0) return 1;
    return Math.max(1, Math.round((hoursPerWeek * 60) / typicalDurationMinutes));
  }

  /**
   * Construit une clé unique identifiant l'occupation d'une entité (professeur ou salle,
   * via son identifiant ou son nom) sur un jour et une heure de début donnés, afin de
   * détecter les doublons de réservation au sein d'un même run de génération.
   * @param entityKey Identifiant du professeur ou nom de la salle.
   * @param slot Créneau concerné (seuls dayOfWeek et startTime entrent dans la clé).
   * @returns Une clé de la forme "entité|jour|heureDébut".
   */
  private comboKey(entityKey: string, slot: CandidateSlot) {
    return `${entityKey}|${slot.dayOfWeek}|${slot.startTime}`;
  }

  /**
   * Vérifie si une classe a déjà une séance planifiée en base qui chevauche le créneau donné,
   * tous cours confondus.
   * @param classId Identifiant de la classe à vérifier.
   * @param slot Créneau candidat.
   * @returns true si la classe est déjà occupée sur ce créneau, false sinon.
   */
  private async isClassBusy(classId: string, slot: CandidateSlot) {
    const conflict = await this.prisma.courseSlot.findFirst({
      where: {
        dayOfWeek: slot.dayOfWeek,
        // Chevauchement d'intervalles : le créneau candidat commence avant la fin
        // d'une séance existante ET finit après le début de cette séance.
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
        course: { subjectRequirement: { classId } },
      },
    });
    return !!conflict;
  }
}
