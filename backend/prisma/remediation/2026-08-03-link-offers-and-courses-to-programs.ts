/**
 * Remédiation (audit + test bout-en-bout, 2026-08-02/03) :
 * 0 des 21 offres et 51 des 52 cours n'étaient liés à aucun programme/niveau
 * (programId / programLevel NULL). Conséquence vérifiée en direct : un
 * paiement confirmé ne déclenche aucune inscription réelle (l'automatisation
 * dans payment.service.ts / application.service.ts exige ce lien pour
 * fonctionner), et même quand l'inscription aboutit, "Mes cours" reste vide.
 *
 * Le code de création (CreateOfferDto, CreateSchoolCourseDto) exige déjà
 * `programId` — ce n'est PAS un bug de l'API, uniquement des données de seed
 * historiques créées avant que ce lien soit obligatoire. Ce script rattrape
 * les données existantes.
 *
 * Le rattachement offre → programme est fiable (11/19 correspondances
 * exactes par nom, 7 déduites du domaine, 1 ("Master Management" — INSCAE)
 * laissée non liée faute de programme correspondant réel).
 *
 * Le rattachement cours → programme/niveau demande un jugement métier (le
 * champ texte libre `level` ne correspond pas toujours à la durée réelle du
 * programme trouvé, ex. "Licence 3" pour un DUT de 2 ans) : le niveau est
 * donc borné à la durée réelle du programme plutôt que de créer un niveau
 * invalide. Quelques cas restent une approximation raisonnable, pas une
 * certitude absolue — à confirmer par un administrateur d'école si besoin.
 *
 * Usage : ts-node prisma/remediation/2026-08-03-link-offers-and-courses-to-programs.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// offerTitle -> programName (même école, résolu par nom)
const OFFER_TO_PROGRAM: Record<string, string> = {
  'DUT Systèmes Informatiques': 'DUT Informatique',
  'Licence Réseaux et Sécurité': 'Licence Informatique',
  'Master Informatique - Intelligence Artificielle': 'Master Informatique',
  'Licence Professionnelle Développement Web': 'Licence Professionnelle Informatique',
  'Licence Relations Publiques': 'Licence Communication',
  'Licence Gestion des Ressources Humaines': 'Licence Management',
  // 'Master Management' (INSCAE) volontairement absente : aucun programme
  // "Master Management" n'existe, seul "Master Entrepreneuriat" existe côté
  // Master — trop différent pour être assimilé sans confirmation humaine.
};

// courseTitle -> programName (résolu par nom, dans la même école que le cours)
const COURSE_TO_PROGRAM: Record<string, string> = {
  // ESPA
  'Bases de données': 'Licence Informatique',
  'Introduction à la programmation': 'Licence Informatique',
  'Structures de données avancées': 'Licence Informatique',
  'Intelligence artificielle': 'Master Informatique',
  'Réseaux informatiques': 'Licence Informatique',
  'Sécurité des systèmes': 'Licence Informatique',
  'Cloud computing': 'Licence Informatique',
  'Génie logiciel': 'Master Informatique',
  'Résistance des matériaux': 'Licence Génie Civil',
  Topographie: 'Licence Génie Civil',
  'Béton armé': 'Licence Génie Civil',
  'Structures métalliques': 'Master Génie Civil',
  Hydraulique: 'Master Génie Civil',
  'Algorithmique et Programmation': 'Licence Informatique',
  "Mathématiques pour l'informatique": 'Licence Informatique',
  // INSCAE
  'Management des organisations': 'Master Entrepreneuriat',
  'Gestion des ressources humaines': 'Licence Management',
  "Stratégie d'entreprise": 'Master Entrepreneuriat',
  Entrepreneuriat: 'Master Entrepreneuriat',
  'Comptabilité générale': 'Licence Finance',
  'Analyse financière': 'Licence Finance',
  'Gestion de portefeuille': 'Licence Finance',
  'Ingénierie financière': 'Master Entrepreneuriat',
  'Marketing fondamental': 'Licence Marketing',
  'Marketing digital': 'Licence Marketing',
  'Introduction au management': 'Licence Management',
  // Université de Toamasina
  Microéconomie: 'Licence Économie',
  Macroéconomie: 'Licence Économie',
  'Économie du développement': 'Licence Économie',
  Anatomie: 'Licence Sciences de la Santé',
  Physiologie: 'Licence Sciences de la Santé',
  'Santé publique': 'Licence Sciences de la Santé',
  // Institut Supérieur de Technologie de Mahajanga
  'Algorithmique de base': 'DUT Informatique',
  "Systèmes d'exploitation": 'DUT Informatique',
  'Programmation orientée objet': 'DUT Informatique',
  'Développement web': 'DUT Informatique',
  'Développement mobile': 'Licence Professionnelle Informatique',
  'Cybersécurité appliquée': 'Licence Professionnelle Informatique',
  'Dessin technique': 'DUT Génie Civil',
  'Topographie appliquée': 'DUT Génie Civil',
  'Chantier et sécurité': 'DUT Génie Civil',
  'Algorithmique appliquée': 'DUT Informatique',
  'Matériaux de construction': 'DUT Génie Civil',
  // Université de Fianarantsoa
  Botanique: 'Licence Agronomie',
  Agroécologie: 'Licence Agronomie',
  'Élevage et zootechnie': 'Licence Agronomie',
  'Développement rural': 'Master Développement Rural',
  // ISCAM
  'Techniques de communication': 'Licence Communication',
  'Relations publiques': 'Licence Communication',
  'Communication digitale': 'Licence Communication',
  'Stratégie de communication': 'Master Communication Stratégique',
};

function parseLevelNumber(levelText: string): number {
  const match = levelText.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

async function linkOffers() {
  const offers = await prisma.offer.findMany({
    where: { programId: null },
    select: { id: true, title: true, schoolId: true },
  });

  let linked = 0;
  for (const offer of offers) {
    const programName = OFFER_TO_PROGRAM[offer.title] ?? offer.title;
    const program = await prisma.schoolProgram.findFirst({
      where: { schoolId: offer.schoolId, name: programName },
    });
    if (!program) {
      console.warn(
        `[offre non liée] "${offer.title}" — aucun programme "${programName}" trouvé, à corriger manuellement`,
      );
      continue;
    }
    await prisma.offer.update({
      where: { id: offer.id },
      data: { programId: program.id },
    });
    linked++;
  }
  console.log(`Offres liées : ${linked}/${offers.length}`);
}

async function linkCourses() {
  const courses = await prisma.course.findMany({
    where: { OR: [{ programId: null }, { programLevel: null }] },
    select: { id: true, title: true, level: true, schoolId: true },
  });

  let linked = 0;
  for (const course of courses) {
    const programName = COURSE_TO_PROGRAM[course.title];
    if (!programName) {
      console.warn(
        `[cours non lié] "${course.title}" — pas de correspondance connue, à corriger manuellement`,
      );
      continue;
    }
    const program = await prisma.schoolProgram.findFirst({
      where: { schoolId: course.schoolId, name: programName },
    });
    if (!program) {
      console.warn(
        `[cours non lié] "${course.title}" — programme "${programName}" introuvable dans cette école`,
      );
      continue;
    }
    const requestedLevel = parseLevelNumber(course.level);
    const level = Math.min(Math.max(requestedLevel, 1), program.durationYears);
    await prisma.course.update({
      where: { id: course.id },
      data: { programId: program.id, programLevel: level },
    });
    linked++;
  }
  console.log(`Cours liés : ${linked}/${courses.length}`);
}

async function main() {
  await linkOffers();
  await linkCourses();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
