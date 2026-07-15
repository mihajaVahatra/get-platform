import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditResource } from './dto/audit-log.dto';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  before?: any;
  after?: any;
  ip?: string;
  userAgent?: string;
  status?: string;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Enregistre une action dans les logs d'audit.
   */
  async log(data: AuditLogData): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        // On passe l'objet directement, Prisma le gère comme Json
        before: data.before ?? undefined,
        after: data.after ?? undefined,
        ip: data.ip,
        userAgent: data.userAgent,
        status: data.status || 'SUCCESS',
        errorMessage: data.errorMessage,
      },
    });
  }

  /**
   * Récupère les logs d'audit avec filtres.
   */
  async getLogs(query: AuditQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.action) where.action = query.action;
    if (query.resource) where.resource = query.resource;
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.from) where.createdAt = { gte: new Date(query.from) };
    if (query.to) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(query.to),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        ...log,
        // Prisma parse déjà le Json, on retourne directement
        before: log.before,
        after: log.after,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupère les logs pour une ressource spécifique.
   */
  async getLogsForResource(resource: AuditResource, resourceId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Récupère les logs pour un utilisateur spécifique.
   */
  async getLogsForUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
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

  /**
   * Statistiques sur les logs d'audit.
   */
  async getStats() {
    const [total, byAction, byResource] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        _count: true,
      }),
    ]);

    return {
      total,
      byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
      byResource: byResource.map((r) => ({ resource: r.resource, count: r._count })),
    };
  }
}
