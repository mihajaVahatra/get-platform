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

@Injectable()
export class PlatformCityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.platformCity.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const city = await this.prisma.platformCity.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('Ville introuvable');
    return city;
  }

  async create(dto: CreatePlatformCityDto) {
    await this.assertNameAvailable(dto.name);
    return this.prisma.platformCity.create({
      data: { name: dto.name.trim(), isActive: dto.isActive ?? true },
    });
  }

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

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.platformCity.delete({ where: { id } });
    return { id };
  }

  private async assertNameAvailable(name: string) {
    const existing = await this.prisma.platformCity.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      throw new BadRequestException('Cette ville existe déjà');
    }
  }
}
