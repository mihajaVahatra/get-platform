import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLandingNewsPostDto } from './dto/landing-news.dto';
import { UpdateLandingNewsPostDto } from './dto/landing-news.dto';

const CONFIG_KEYS = {
  hero: 'landing.hero',
  stats: 'landing.stats',
  steps: 'landing.steps',
  actorCards: 'landing.actorCards',
} as const;

const DEFAULTS = {
  hero: {
    title: 'Ton avenir\ncommence ici.',
    subtitle:
      'GET est la plateforme officielle qui simplifie ton parcours post-bac : candidatures, concours, paiements et inscriptions, tout en un seul endroit.',
  },
  stats: [
    { icon: 'Building2', value: '50+', label: 'Établissements partenaires' },
    { icon: 'UserRound', value: '30 000+', label: 'Étudiants inscrits' },
    { icon: 'ClipboardCheck', value: '100 000+', label: 'Candidatures traitées' },
    { icon: 'ShieldCheck', value: '100%', label: 'Paiements sécurisés' },
  ],
  steps: [
    { title: 'Crée ton compte', text: 'Inscris-toi gratuitement en quelques minutes.' },
    { title: 'Choisis et postule', text: 'Découvre les formations et envoie tes candidatures.' },
    { title: 'Suis ton parcours', text: "Suis l'évolution de ton dossier, tes concours et résultats." },
    { title: 'Inscris-toi en ligne', text: 'Paie tes frais en toute sécurité et finalise ton inscription.' },
  ],
  actorCards: [
    { icon: 'GraduationCap', title: 'Pour les étudiants', text: 'Candidature simplifiée, suivi en temps réel, paiements sécurisés et accès aux informations essentielles.' },
    { icon: 'Building2', title: 'Pour les écoles', text: 'Gestion centralisée des candidatures, suivi des inscriptions, outils de communication et tableaux de bord performants.' },
    { icon: 'Landmark', title: 'Pour les partenaires', text: "Intégration bancaire et mobile, paiements sécurisés et promotion de l'inclusion financière des jeunes." },
    { icon: 'ShieldCheck', title: 'Pour le ministère', text: "Pilotage stratégique, statistiques fiables et amélioration continue du système d'enseignement supérieur." },
  ],
};

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: Object.values(CONFIG_KEYS) } },
    });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      hero: byKey[CONFIG_KEYS.hero] ?? DEFAULTS.hero,
      stats: byKey[CONFIG_KEYS.stats] ?? DEFAULTS.stats,
      steps: byKey[CONFIG_KEYS.steps] ?? DEFAULTS.steps,
      actorCards: byKey[CONFIG_KEYS.actorCards] ?? DEFAULTS.actorCards,
    };
  }

  async setHero(value: unknown) {
    return this.setConfig(CONFIG_KEYS.hero, value);
  }

  async setStats(value: unknown) {
    return this.setConfig(CONFIG_KEYS.stats, value);
  }

  async setSteps(value: unknown) {
    return this.setConfig(CONFIG_KEYS.steps, value);
  }

  async setActorCards(value: unknown) {
    return this.setConfig(CONFIG_KEYS.actorCards, value);
  }

  private async setConfig(key: string, value: unknown) {
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    return { key, value };
  }

  async getPublishedNews(limit = 3) {
    const currentLimit = Math.min(Math.max(Number(limit) || 3, 1), 20);
    const items = await this.prisma.landingNewsPost.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { publishedAt: 'desc' }],
      take: currentLimit,
    });
    return items;
  }

  async getAllNews(page = 1, limit = 20) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [items, total] = await Promise.all([
      this.prisma.landingNewsPost.findMany({
        where: { deletedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { publishedAt: 'desc' }],
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
      }),
      this.prisma.landingNewsPost.count({ where: { deletedAt: null } }),
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

  async createNews(dto: CreateLandingNewsPostDto) {
    return this.prisma.landingNewsPost.create({
      data: {
        type: dto.type.trim(),
        title: dto.title.trim(),
        body: dto.body.trim(),
        isPublished: dto.isPublished ?? true,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateNews(id: string, dto: UpdateLandingNewsPostDto) {
    await this.ensureNewsExists(id);
    return this.prisma.landingNewsPost.update({
      where: { id },
      data: {
        type: dto.type?.trim(),
        title: dto.title?.trim(),
        body: dto.body?.trim(),
        isPublished: dto.isPublished,
        displayOrder: dto.displayOrder,
      },
    });
  }

  async deleteNews(id: string) {
    await this.ensureNewsExists(id);
    return this.prisma.landingNewsPost.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });
  }

  async setNewsPhoto(id: string, imageUrl: string) {
    await this.ensureNewsExists(id);
    await this.prisma.landingNewsPost.update({
      where: { id },
      data: { imageUrl },
    });
    return { imageUrl };
  }

  async getPartners() {
    const [schools, partners] = await Promise.all([
      this.prisma.school.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, logo: true },
        orderBy: { name: 'asc' },
        take: 60,
      }),
      this.prisma.financialPartner.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, logo: true, type: true },
        orderBy: { name: 'asc' },
        take: 60,
      }),
    ]);
    return {
      schools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        logoUrl: school.logo,
        kind: 'SCHOOL' as const,
      })),
      financialPartners: partners.map((partner) => ({
        id: partner.id,
        name: partner.name,
        logoUrl: partner.logo,
        kind: partner.type,
      })),
    };
  }

  private async ensureNewsExists(id: string) {
    const post = await this.prisma.landingNewsPost.findFirst({
      where: { id, deletedAt: null },
    });
    if (!post) throw new NotFoundException('Actualité introuvable');
    return post;
  }
}
