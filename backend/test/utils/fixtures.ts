import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as speakeasy from 'speakeasy';
import type request from 'supertest';

/**
 * Client Prisma dédié aux fixtures e2e (création/nettoyage), distinct de
 * celui injecté dans l'app testée — évite toute dépendance à l'ordre
 * d'initialisation du module Nest pour préparer les données.
 */
export const prisma = new PrismaClient();

/** Préfixe commun à toutes les données créées par les tests e2e — permet un
 * nettoyage ciblé sans toucher aux données de développement existantes. */
export const E2E_PREFIX = 'e2e-';

/** Identifiant unique par exécution de fichier de test (à générer une fois
 * en `beforeAll` et à passer à chaque fixture) — permet à `cleanupE2eData`
 * de ne retirer que les données de CE run, jamais celles d'un autre fichier
 * exécuté en parallèle. */
export function newRunId(): string {
  return uuidv4().slice(0, 8);
}

export function e2eEmail(runId: string, label: string): string {
  return `${E2E_PREFIX}${runId}-${label}@get-poc-e2e.test`;
}

export async function ensureRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

export async function createUser(params: {
  email: string;
  password: string;
  roleName: string;
  mfaEnabled?: boolean;
}) {
  const role = await ensureRole(params.roleName);
  const passwordHash = await bcrypt.hash(params.password, 10);
  return prisma.user.create({
    data: {
      email: params.email,
      password: passwordHash,
      roleId: role.id,
      isVerified: true,
      mfaEnabled: params.mfaEnabled ?? false,
    },
  });
}

export async function createStudent(params: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const user = await createUser({ ...params, roleName: 'STUDENT' });
  const student = await prisma.student.create({
    data: {
      userId: user.id,
      firstName: params.firstName ?? 'Test',
      lastName: params.lastName ?? 'E2E',
    },
  });
  return { user, student };
}

export async function createSchoolAdmin(params: {
  email: string;
  password: string;
  schoolId: string;
}) {
  const user = await createUser({ ...params, roleName: 'SCHOOL_ADMIN' });
  const schoolAdmin = await prisma.schoolAdmin.create({
    data: { userId: user.id, schoolId: params.schoolId, permissions: [] },
  });
  return { user, schoolAdmin };
}

export async function createPrivilegedUser(params: {
  email: string;
  password: string;
  roleName: 'ADMIN_GET' | 'SCHOOL_ADMIN' | 'MINISTRY';
}) {
  return createUser(params);
}

/**
 * Active réellement le MFA sur un agent déjà connecté (session cookies déjà
 * posés), via le vrai parcours d'enrôlement (`POST /auth/mfa/enable` puis
 * `/auth/mfa/verify` avec un code TOTP valide) — jamais une écriture directe
 * de `mfaEnabled` en base, qui laisserait `mfaSecret` vide et casserait la
 * page suivante nécessitant un second facteur.
 *
 * Peut s'appeler APRÈS le login initial sans avoir à se reconnecter :
 * `JwtStrategy.validate` recharge l'utilisateur depuis la base à chaque
 * requête (jamais depuis le payload du JWT), donc les mêmes cookies de
 * session restent valides une fois le MFA activé — nécessaire pour
 * `MfaEnforcedGuard`, qui bloque désormais (403) tout endpoint mutable pour
 * un ADMIN_GET/SCHOOL_ADMIN/MINISTRY sans MFA actif.
 */
export async function enrollMfa(
  agent: ReturnType<typeof request.agent>,
): Promise<void> {
  const enableResponse = await agent.post('/api/auth/mfa/enable').expect(201);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- réponse Supertest (.body) non typée par nature (any)
  const secret: string = enableResponse.body.secret;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- @types/speakeasy résout mal ses propres types, voir le même disable dans mfa.e2e-spec.ts
  const code: string = speakeasy.totp({ secret, encoding: 'base32' });
  await agent.post('/api/auth/mfa/verify').send({ code }).expect(201);
}

export async function createSchool(params: {
  runId: string;
  label?: string;
  name?: string;
  city?: string;
}) {
  const label = params.label ?? uuidv4().slice(0, 6);
  return prisma.school.create({
    data: {
      name: params.name ?? `École e2e ${params.runId}-${label}`,
      slug: `${E2E_PREFIX}${params.runId}-school-${label}`,
      city: params.city ?? 'Antananarivo',
    },
  });
}

export async function createOffer(params: {
  schoolId: string;
  capacity?: number;
  tuitionFees?: number;
}) {
  const suffix = uuidv4().slice(0, 8);
  return prisma.offer.create({
    data: {
      schoolId: params.schoolId,
      title: `Offre e2e ${suffix}`,
      slug: `${E2E_PREFIX}offer-${suffix}`,
      diploma: 'Licence',
      duration: 3,
      tuitionFees: params.tuitionFees ?? 4_500_000,
      academicYear: '2026-2027',
      capacity: params.capacity,
      isOpen: true,
    },
  });
}

/** Supprime toutes les données créées par un test e2e, identifiées par
 * préfixe d'email (users, cascade vers student/schoolAdmin/applications/
 * payments/documents) et par slug (schools, cascade vers offers). */
export async function cleanupE2eData(runId: string) {
  await prisma.user.deleteMany({
    where: { email: { contains: runId } },
  });
  await prisma.school.deleteMany({
    where: { slug: { contains: runId } },
  });
}

export async function disconnectFixtures() {
  await prisma.$disconnect();
}
