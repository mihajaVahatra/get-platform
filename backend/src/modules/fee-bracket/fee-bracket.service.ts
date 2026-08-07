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

@Injectable()
export class FeeBracketService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.feeBracket.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { minFees: 'asc' }],
    });
  }

  async findOne(id: string) {
    const bracket = await this.prisma.feeBracket.findUnique({ where: { id } });
    if (!bracket) throw new NotFoundException('Tranche de frais introuvable');
    return bracket;
  }

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

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.feeBracket.delete({ where: { id } });
    return { id };
  }

  private assertRange(minFees: number, maxFees?: number) {
    if (maxFees !== undefined && maxFees !== null && maxFees <= minFees) {
      throw new BadRequestException(
        'Le montant maximum doit être supérieur au minimum',
      );
    }
  }

  private async assertLabelAvailable(label: string) {
    const existing = await this.prisma.feeBracket.findUnique({
      where: { label: label.trim() },
    });
    if (existing) {
      throw new BadRequestException('Une tranche de frais porte déjà ce nom');
    }
  }
}
