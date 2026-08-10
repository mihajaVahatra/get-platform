import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePlatformCityDto,
  UpdatePlatformCityDto,
} from './dto/platform-city.dto';

/**
 * Service métier de gestion des villes de la plateforme (platform cities).
 * Encapsule la règle d'unicité du nom et l'accès Prisma à la table platformCity.
 */
@Injectable()
export class PlatformCityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Récupère toutes les villes, triées : actives d'abord, puis par nom alphabétique. */
  async findAll() {
    return this.prisma.platformCity.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Récupère une ville par son identifiant.
   * @throws NotFoundException si aucune ville ne correspond à l'id.
   */
  async findOne(id: string) {
    const city = await this.prisma.platformCity.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('Ville introuvable');
    return city;
  }

  /**
   * Crée une nouvelle ville après validation de l'unicité du nom.
   * @throws BadRequestException si le nom est déjà utilisé.
   */
  async create(dto: CreatePlatformCityDto) {
    await this.assertNameAvailable(dto.name);
    return this.prisma.platformCity.create({
      data: { name: dto.name.trim(), isActive: dto.isActive ?? true },
    });
  }

  /**
   * Met à jour une ville existante.
   * Ne revérifie l'unicité du nom que s'il change réellement.
   * @throws NotFoundException si la ville n'existe pas.
   * @throws BadRequestException si le nouveau nom est déjà pris.
   */
  async update(id: string, dto: UpdatePlatformCityDto) {
    const city = await this.findOne(id);
    if (dto.name && dto.name.trim() !== city.name) {
      await this.assertNameAvailable(dto.name);
    }
    return this.prisma.platformCity.update({
      where: { id },
      data: { name: dto.name?.trim(), isActive: dto.isActive },
    });
  }

  /**
   * Supprime une ville après avoir vérifié son existence.
   * @throws NotFoundException si la ville n'existe pas.
   * @returns l'id de la ville supprimée.
   */
  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.platformCity.delete({ where: { id } });
    return { id };
  }

  /**
   * Vérifie qu'aucune autre ville n'utilise déjà ce nom (contrainte d'unicité métier).
   * @throws BadRequestException si le nom est déjà pris.
   */
  private async assertNameAvailable(name: string) {
    const existing = await this.prisma.platformCity.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      throw new BadRequestException('Cette ville existe déjà');
    }
  }
}
