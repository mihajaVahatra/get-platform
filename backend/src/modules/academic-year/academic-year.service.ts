import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';

@Injectable()
export class AcademicYearService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
  }

  async findOne(id: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException('Année scolaire introuvable');
    return year;
  }

  async create(dto: CreateAcademicYearDto) {
    this.assertDateOrder(dto.startDate, dto.endDate);
    await this.assertLabelAvailable(dto.label);

    if (dto.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicYear.create({
      data: {
        label: dto.label.trim(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isCurrent: dto.isCurrent ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateAcademicYearDto) {
    const year = await this.findOne(id);
    const startDate = dto.startDate ?? year.startDate.toISOString();
    const endDate = dto.endDate ?? year.endDate.toISOString();
    this.assertDateOrder(startDate, endDate);
    if (dto.label && dto.label.trim() !== year.label) {
      await this.assertLabelAvailable(dto.label);
    }

    if (dto.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicYear.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isCurrent: dto.isCurrent,
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    const dependents = await this.prisma.schoolClass.count({ where: { academicYearId: id } });
    if (dependents > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une année scolaire déjà utilisée par des classes',
      );
    }
    await this.prisma.academicYear.delete({ where: { id } });
    return { id };
  }

  private assertDateOrder(startDate: string, endDate: string) {
    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }
  }

  private async assertLabelAvailable(label: string) {
    const existing = await this.prisma.academicYear.findUnique({
      where: { label: label.trim() },
    });
    if (existing) {
      throw new BadRequestException('Une année scolaire porte déjà ce nom');
    }
  }
}
