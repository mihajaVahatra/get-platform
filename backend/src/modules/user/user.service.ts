import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    page = 1,
    limit = 20,
    filters?: { search?: string; roleName?: string; isActive?: string },
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (filters?.search) {
      where.email = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters?.roleName) {
      where.role = { name: filters.roleName };
    }
    if (filters?.isActive !== undefined && filters.isActive !== '') {
      where.isActive = filters.isActive === 'true';
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          isActive: true,
          isVerified: true,
          lastLogin: true,
          createdAt: true,
          role: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
          teacher: { select: { firstName: true, lastName: true } },
          schoolAdmin: { select: { school: { select: { name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        role: user.role?.name || null,
        displayName:
          [user.student?.firstName, user.student?.lastName].filter(Boolean).join(' ') ||
          [user.teacher?.firstName, user.teacher?.lastName].filter(Boolean).join(' ') ||
          null,
        school: user.schoolAdmin?.school.name || null,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  async setActive(id: string, isActive: boolean, currentUserId: string) {
    if (id === currentUserId && !isActive) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }
}
