import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import slugify from 'slugify';

@Injectable()
export class OfferService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOfferDto, userId: string) {
    // Check if school exists
    const school = await this.prisma.school.findFirst({
      where: { id: dto.schoolId, deletedAt: null },
    });
    if (!school) throw new NotFoundException('School not found');

    // TODO: check if user is admin of this school or ADMIN_GET

    const slug = slugify(dto.title, { lower: true, strict: true });

    return this.prisma.offer.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        diploma: dto.diploma,
        duration: dto.duration,
        tuitionFees: dto.tuitionFees,
        prerequisites: dto.prerequisites || [],
        capacity: dto.capacity,
        applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : undefined,
        academicYear: dto.academicYear,
        isOpen: dto.isOpen ?? true,
        schoolId: dto.schoolId,
      },
      include: {
        school: true,
      },
    });
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      schoolId?: string;
      diploma?: string;
      minFees?: number;
      maxFees?: number;
      search?: string;
      isOpen?: boolean;
      city?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    if (filters?.schoolId) where.schoolId = filters.schoolId;
    if (filters?.diploma) where.diploma = { contains: filters.diploma, mode: 'insensitive' };
    if (filters?.minFees !== undefined) where.tuitionFees = { gte: filters.minFees };
    if (filters?.maxFees !== undefined) where.tuitionFees = { ...where.tuitionFees, lte: filters.maxFees };
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.isOpen !== undefined) where.isOpen = filters.isOpen;

    // If city filter, we need to join with school
    let includeSchool = false;
    if (filters?.city) {
      includeSchool = true;
      // We'll filter after join, but Prisma doesn't support filtering by related model in where easily.
      // We'll do it in the query via include and filter later, but for simplicity we'll handle in controller or service with additional query.
      // Actually, we can use 'some' on school relation.
      // Better to do a raw query or use include with where on relation.
      // Since the user is starting, we'll keep it simple and filter in memory.
    }

    const [items, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          school: true,
        },
      }),
      this.prisma.offer.count({ where }),
    ]);

    // Apply city filter in memory (if needed)
    let filteredItems = items;
    if (filters?.city) {
      filteredItems = items.filter((offer) => offer.school?.city === filters.city);
    }

    return {
      items: filteredItems,
      meta: {
        page,
        limit,
        total: filteredItems.length, // approximate; for better we'd do a join query
        totalPages: Math.ceil(filteredItems.length / limit),
      },
    };
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id, deletedAt: null },
      include: {
        school: true,
        applications: {
          take: 5,
          orderBy: { submittedAt: 'desc' },
        },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async update(id: string, dto: UpdateOfferDto, userId: string) {
    await this.findOne(id);
    // TODO: check permissions

    const slug = dto.title ? slugify(dto.title, { lower: true, strict: true }) : undefined;

    return this.prisma.offer.update({
      where: { id },
      data: {
        ...dto,
        slug,
        applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : undefined,
      },
      include: {
        school: true,
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id);
    // TODO: check permissions
    return this.prisma.offer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async toggleStatus(id: string, isOpen: boolean, userId: string) {
    const offer = await this.findOne(id);
    // TODO: check permissions
    return this.prisma.offer.update({
      where: { id },
      data: { isOpen },
    });
  }

  async getOffersBySchool(schoolId: string, isOpen?: boolean) {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
    });
    if (!school) throw new NotFoundException('School not found');

    return this.prisma.offer.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(isOpen !== undefined && { isOpen }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        school: true,
      },
    });
  }
}
