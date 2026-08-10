import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

/** Gère les concours d'admission : liste paginée/filtrée, création, mise à jour et suppression logique. */
@Injectable()
export class CompetitionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne une page de concours (non supprimés) avec le nombre total et le nombre de
   * pages, filtrables par école, statut et recherche insensible à la casse sur le nom.
   * `page`/`limit` sont bornés (page >= 1, limit entre 1 et 100) pour éviter les requêtes abusives.
   */
  async findAll(
    page = 1,
    limit = 20,
    filters?: { schoolId?: string; status?: string; search?: string },
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const where: Prisma.CompetitionWhereInput = { deletedAt: null };
    if (filters?.schoolId) where.schoolId = filters.schoolId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.competition.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          school: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
        },
      }),
      this.prisma.competition.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  /** Crée un concours ; le statut par défaut est `PLANNED` si non fourni. */
  async create(dto: CreateCompetitionDto) {
    return this.prisma.competition.create({
      data: {
        schoolId: dto.schoolId,
        programId: dto.programId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : undefined,
        capacity: dto.capacity,
        status: dto.status ?? 'PLANNED',
      },
      include: {
        school: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Met à jour un concours existant.
   * @throws {NotFoundException} Si le concours n'existe pas (ou est supprimé).
   */
  async update(id: string, dto: UpdateCompetitionDto) {
    await this.ensureExists(id);
    return this.prisma.competition.update({
      where: { id },
      data: {
        schoolId: dto.schoolId,
        programId: dto.programId,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : undefined,
        capacity: dto.capacity,
        status: dto.status,
      },
      include: {
        school: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Supprime logiquement un concours (marque `deletedAt` et désactive `isActive`) plutôt
   * que de le supprimer physiquement, afin de conserver l'historique.
   * @throws {NotFoundException} Si le concours n'existe pas (ou est déjà supprimé).
   */
  async delete(id: string) {
    await this.ensureExists(id);
    return this.prisma.competition.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * Vérifie qu'un concours existe et n'est pas supprimé logiquement.
   * @throws {NotFoundException} Sinon.
   */
  private async ensureExists(id: string) {
    const competition = await this.prisma.competition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!competition) throw new NotFoundException('Competition not found');
    return competition;
  }
}
