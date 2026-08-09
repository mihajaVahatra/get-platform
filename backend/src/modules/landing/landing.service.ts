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

type SupportedLocale = 'fr' | 'en';
const SUPPORTED_LOCALES: SupportedLocale[] = ['fr', 'en'];
const DEFAULT_LOCALE: SupportedLocale = 'fr';

// Chaque section est stockée en base sous la forme bilingue { fr, en }
// (voir DEFAULTS). Du contenu enregistré avant l'introduction du bilingue
// n'a pas cette enveloppe — c'est directement l'objet/tableau french — donc
// `resolveLocaleValue` le traite comme la variante `fr` plutôt que de le
// perdre, et retombe sur `fr` tant que l'admin n'a pas renseigné l'anglais
// pour une section donnée.
const DEFAULTS: Record<string, Record<SupportedLocale, unknown>> = {
  [CONFIG_KEYS.hero]: {
    fr: {
      title: 'Ton avenir\ncommence ici.',
      subtitle:
        'GET est la plateforme officielle qui simplifie ton parcours post-bac : candidatures, concours, paiements et inscriptions, tout en un seul endroit.',
    },
    en: {
      title: 'Your future\nstarts here.',
      subtitle:
        'GET is the official platform that simplifies your post-secondary journey: applications, entrance exams, payments and enrollment, all in one place.',
    },
  },
  [CONFIG_KEYS.stats]: {
    fr: [
      { icon: 'Building2', value: '50+', label: 'Établissements partenaires' },
      { icon: 'UserRound', value: '30 000+', label: 'Étudiants inscrits' },
      { icon: 'ClipboardCheck', value: '100 000+', label: 'Candidatures traitées' },
      { icon: 'ShieldCheck', value: '100%', label: 'Paiements sécurisés' },
    ],
    en: [
      { icon: 'Building2', value: '50+', label: 'Partner institutions' },
      { icon: 'UserRound', value: '30,000+', label: 'Enrolled students' },
      { icon: 'ClipboardCheck', value: '100,000+', label: 'Applications processed' },
      { icon: 'ShieldCheck', value: '100%', label: 'Secure payments' },
    ],
  },
  [CONFIG_KEYS.steps]: {
    fr: [
      { title: 'Crée ton compte', text: 'Inscris-toi gratuitement en quelques minutes.' },
      { title: 'Choisis et postule', text: 'Découvre les formations et envoie tes candidatures.' },
      { title: 'Suis ton parcours', text: "Suis l'évolution de ton dossier, tes concours et résultats." },
      { title: 'Inscris-toi en ligne', text: 'Paie tes frais en toute sécurité et finalise ton inscription.' },
    ],
    en: [
      { title: 'Create your account', text: 'Sign up for free in a few minutes.' },
      { title: 'Choose and apply', text: 'Discover programs and submit your applications.' },
      { title: 'Track your journey', text: 'Follow your file, entrance exams and results.' },
      { title: 'Enroll online', text: 'Pay your fees securely and finalize your enrollment.' },
    ],
  },
  [CONFIG_KEYS.actorCards]: {
    fr: [
      { icon: 'GraduationCap', title: 'Pour les étudiants', text: 'Candidature simplifiée, suivi en temps réel, paiements sécurisés et accès aux informations essentielles.' },
      { icon: 'Building2', title: 'Pour les écoles', text: 'Gestion centralisée des candidatures, suivi des inscriptions, outils de communication et tableaux de bord performants.' },
      { icon: 'Landmark', title: 'Pour les partenaires', text: "Intégration bancaire et mobile, paiements sécurisés et promotion de l'inclusion financière des jeunes." },
      { icon: 'ShieldCheck', title: 'Pour le ministère', text: "Pilotage stratégique, statistiques fiables et amélioration continue du système d'enseignement supérieur." },
    ],
    en: [
      { icon: 'GraduationCap', title: 'For students', text: 'Simplified applications, real-time tracking, secure payments and access to essential information.' },
      { icon: 'Building2', title: 'For schools', text: 'Centralized application management, enrollment tracking, communication tools and powerful dashboards.' },
      { icon: 'Landmark', title: 'For partners', text: 'Banking and mobile integration, secure payments and promotion of financial inclusion for youth.' },
      { icon: 'ShieldCheck', title: 'For the ministry', text: 'Strategic oversight, reliable statistics and continuous improvement of the higher education system.' },
    ],
  },
};

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(locale?: string) {
    const resolvedLocale = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
      ? (locale as SupportedLocale)
      : DEFAULT_LOCALE;
    const byKey = await this.getConfigRows();
    return {
      hero: this.resolveLocaleValue(CONFIG_KEYS.hero, byKey[CONFIG_KEYS.hero], resolvedLocale),
      stats: this.resolveLocaleValue(CONFIG_KEYS.stats, byKey[CONFIG_KEYS.stats], resolvedLocale),
      steps: this.resolveLocaleValue(CONFIG_KEYS.steps, byKey[CONFIG_KEYS.steps], resolvedLocale),
      actorCards: this.resolveLocaleValue(
        CONFIG_KEYS.actorCards,
        byKey[CONFIG_KEYS.actorCards],
        resolvedLocale,
      ),
    };
  }

  async getRawConfig() {
    const byKey = await this.getConfigRows();
    return {
      hero: this.resolveBilingualValue(CONFIG_KEYS.hero, byKey[CONFIG_KEYS.hero]),
      stats: this.resolveBilingualValue(CONFIG_KEYS.stats, byKey[CONFIG_KEYS.stats]),
      steps: this.resolveBilingualValue(CONFIG_KEYS.steps, byKey[CONFIG_KEYS.steps]),
      actorCards: this.resolveBilingualValue(CONFIG_KEYS.actorCards, byKey[CONFIG_KEYS.actorCards]),
    };
  }

  private async getConfigRows(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: Object.values(CONFIG_KEYS) } },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  // Retombe sur la variante `fr` quand la variante demandée est absente
  // (contenu pas encore traduit par l'admin) ou quand la valeur stockée est
  // au format pré-bilingue (pas d'enveloppe { fr, en }).
  private resolveLocaleValue(key: string, stored: unknown, locale: SupportedLocale) {
    const bilingual = this.resolveBilingualValue(key, stored);
    return bilingual[locale] ?? bilingual[DEFAULT_LOCALE];
  }

  private resolveBilingualValue(
    key: string,
    stored: unknown,
  ): Record<SupportedLocale, unknown> {
    if (stored && typeof stored === 'object' && 'fr' in stored) {
      const value = stored as Record<string, unknown>;
      return { fr: value.fr, en: value.en ?? value.fr };
    }
    if (stored !== undefined) {
      // Format pré-bilingue : la valeur brute est la variante française.
      return { fr: stored, en: DEFAULTS[key].en };
    }
    return DEFAULTS[key] as Record<SupportedLocale, unknown>;
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
