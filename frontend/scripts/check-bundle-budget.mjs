#!/usr/bin/env node
// Budget de bundle : somme la taille de tout le JS client généré par
// `next build` (.next/static/chunks/**/*.js) et échoue si elle dépasse le
// seuil ci-dessous — sans ça, un import mal placé (ex. une librairie lourde
// tirée dans un composant client par erreur) ne se remarque qu'une fois le
// temps de chargement dégradé en production, jamais en CI.
//
// Turbopack (build par défaut de ce projet) ne produit plus le tableau
// "First Load JS" par route de l'ancien build webpack — mesurer la taille
// totale des chunks sur disque est la métrique la plus stable et la moins
// dépendante des détails internes (susceptibles de changer entre versions
// de Next.js) pour un budget vérifiable en CI.
//
// Seuil de départ : mesuré à ~3.39 Mo au 2026-08-11, fixé à 4.5 Mo (marge
// d'environ 30%) — à resserrer progressivement une fois une tendance
// observée dans le temps, jamais à desserrer sans une raison documentée
// (nouvelle dépendance lourde délibérée, etc.).

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CHUNKS_DIR = join(process.cwd(), '.next', 'static', 'chunks');
const BUDGET_BYTES = 4.5 * 1024 * 1024;

function collectJsFiles(dir) {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

let files;
try {
  files = collectJsFiles(CHUNKS_DIR);
} catch (error) {
  console.error(
    `Impossible de lire ${CHUNKS_DIR} — exécuter "npm run build" avant ce script.`,
  );
  console.error(error.message);
  process.exit(2);
}

const total = files.reduce((sum, file) => sum + statSync(file).size, 0);

console.log(`Bundle client (.next/static/chunks) : ${files.length} fichiers JS, ${formatMb(total)}`);
console.log(`Budget : ${formatMb(BUDGET_BYTES)}`);

if (total > BUDGET_BYTES) {
  console.error(
    `\n✗ Le bundle dépasse le budget de ${formatMb(total - BUDGET_BYTES)}.`,
  );
  console.error(
    'Vérifiez les imports récents (librairie lourde importée dans un composant client, dépendance dupliquée...).',
  );
  process.exit(1);
}

console.log(`\n✓ Dans le budget (marge : ${formatMb(BUDGET_BYTES - total)}).`);
