import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import slugify from 'slugify';

@Injectable()
export class SchoolService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSchoolDto, userId: string) {
    const slug = slugify(dto.name, { lower: true, strict: true });
    const data: any = {
      name: dto.name,
      slug,
      type: dto.type,
      isActive: true,
    };
    if (dto.description) data.description = dto.description;
    if (dto.city) data.city = dto.city;
    if (dto.region) data.region = dto.region;
    if (dto.contactEmail) data.contactEmail = dto.contactEmail;
    if (dto.contactPhone) data.contactPhone = dto.contactPhone;
    if (dto.website) data.website = dto.website;

    const school = await this.prisma.school.create({ data });
    return school;
  }

  async findAll(page = 1, limit = 20, filters?: { city?: string; type?: string; search?: string }) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters?.type) where.type = filters.type;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          offers: {
            where: { isOpen: true, deletedAt: null },
            take: 5,
          },
        },
      }),
      this.prisma.school.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findFirst({
      where: { id, deletedAt: null },
      include: {
        offers: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async update(id: string, dto: UpdateSchoolDto, userId: string) {
    await this.findOne(id);
    const slug = dto.name ? slugify(dto.name, { lower: true, strict: true }) : undefined;
    return this.prisma.school.update({
      where: { id },
      data: {
        ...dto,
        slug,
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.school.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ========== LOGO ==========

  async updateLogo(schoolId: string, logoUrl: string) {
    const school = await this.findOne(schoolId);
    return this.prisma.school.update({
      where: { id: schoolId },
      data: { logo: logoUrl },
    });
  }
}
