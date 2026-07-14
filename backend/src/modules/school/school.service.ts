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
    const school = await this.prisma.school.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        type: dto.type,
        city: dto.city,
        region: dto.region,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        // Later: create SchoolAdmin entry for userId
      },
    });
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
    // TODO: check if user is admin of this school or ADMIN_GET
    const school = await this.findOne(id);
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
    // TODO: check if user is admin of this school or ADMIN_GET
    await this.findOne(id);
    return this.prisma.school.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
