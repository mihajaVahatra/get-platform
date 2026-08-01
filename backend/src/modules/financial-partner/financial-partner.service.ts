import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialPartnerDto } from './dto/create-financial-partner.dto';
import { UpdateFinancialPartnerDto } from './dto/update-financial-partner.dto';

@Injectable()
export class FinancialPartnerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    page = 1,
    limit = 20,
    filters?: { type?: string; search?: string },
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const where: Prisma.FinancialPartnerWhereInput = { deletedAt: null };
    if (filters?.type) where.type = filters.type;
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.financialPartner.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financialPartner.count({ where }),
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

  async create(dto: CreateFinancialPartnerDto) {
    return this.prisma.financialPartner.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type ?? 'OTHER',
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
      },
    });
  }

  async update(id: string, dto: UpdateFinancialPartnerDto) {
    await this.ensureExists(id);
    return this.prisma.financialPartner.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        type: dto.type,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
      },
    });
  }

  async delete(id: string) {
    await this.ensureExists(id);
    return this.prisma.financialPartner.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async updateLogo(id: string, logoUrl: string) {
    await this.ensureExists(id);
    return this.prisma.financialPartner.update({
      where: { id },
      data: { logo: logoUrl },
    });
  }

  private async ensureExists(id: string) {
    const partner = await this.prisma.financialPartner.findFirst({
      where: { id, deletedAt: null },
    });
    if (!partner) throw new NotFoundException('Financial partner not found');
    return partner;
  }
}
