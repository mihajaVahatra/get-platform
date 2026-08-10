import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFeeBracketDto,
  UpdateFeeBracketDto,
} from './dto/fee-bracket.dto';

/**
 * Service métier de gestion des tranches de frais (fee brackets).
 * Encapsule les règles de validation (cohérence min/max, unicité du label)
 * et l'accès Prisma à la table feeBracket.
 */
@Injectable()
export class FeeBracketService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les tranches de frais, triées pour l'affichage :
   * actives d'abord, puis par ordre de tri, puis par montant minimum croissant.
   */
  async findAll() {
    return this.prisma.feeBracket.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { minFees: 'asc' }],
    });
  }

  /**
   * Récupère une tranche de frais par son identifiant.
   * @throws NotFoundException si aucune tranche ne correspond à l'id.
   */
  async findOne(id: string) {
    const bracket = await this.prisma.feeBracket.findUnique({ where: { id } });
    if (!bracket) throw new NotFoundException('Tranche de frais introuvable');
    return bracket;
  }

  /**
   * Crée une nouvelle tranche de frais après validation du range et du label.
   * @throws BadRequestException si maxFees <= minFees ou si le label est déjà utilisé.
   */
  async create(dto: CreateFeeBracketDto) {
    this.assertRange(dto.minFees, dto.maxFees);
    await this.assertLabelAvailable(dto.label);
    return this.prisma.feeBracket.create({
      data: {
        label: dto.label.trim(),
        minFees: dto.minFees,
        maxFees: dto.maxFees,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Met à jour une tranche de frais existante.
   * Recalcule la cohérence min/max en combinant les valeurs fournies avec
   * celles déjà enregistrées, et ne revérifie l'unicité du label que s'il change réellement.
   * @throws NotFoundException si la tranche n'existe pas.
   * @throws BadRequestException si le nouveau range est invalide ou le nouveau label déjà pris.
   */
  async update(id: string, dto: UpdateFeeBracketDto) {
    const bracket = await this.findOne(id);
    const minFees = dto.minFees ?? bracket.minFees;
    const maxFees =
      dto.maxFees !== undefined ? dto.maxFees : (bracket.maxFees ?? undefined);
    this.assertRange(minFees, maxFees ?? undefined);
    if (dto.label && dto.label.trim() !== bracket.label) {
      await this.assertLabelAvailable(dto.label);
    }
    return this.prisma.feeBracket.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        minFees: dto.minFees,
        maxFees: dto.maxFees,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Supprime une tranche de frais après avoir vérifié son existence.
   * @throws NotFoundException si la tranche n'existe pas.
   * @returns l'id de la tranche supprimée.
   */
  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.feeBracket.delete({ where: { id } });
    return { id };
  }

  /**
   * Vérifie que le montant maximum est strictement supérieur au minimum.
   * Pas de vérification si maxFees est absent (tranche sans borne haute).
   * @throws BadRequestException si le range est incohérent.
   */
  private assertRange(minFees: number, maxFees?: number) {
    if (maxFees !== undefined && maxFees !== null && maxFees <= minFees) {
      throw new BadRequestException(
        'Le montant maximum doit être supérieur au minimum',
      );
    }
  }

  /**
   * Vérifie qu'aucune autre tranche n'utilise déjà ce label (contrainte d'unicité métier).
   * @throws BadRequestException si le label est déjà pris.
   */
  private async assertLabelAvailable(label: string) {
    const existing = await this.prisma.feeBracket.findUnique({
      where: { label: label.trim() },
    });
    if (existing) {
      throw new BadRequestException('Une tranche de frais porte déjà ce nom');
    }
  }
}
