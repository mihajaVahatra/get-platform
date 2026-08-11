#!/usr/bin/env node
// Bloque la CI uniquement sur les erreurs/avertissements ESLint situés sur
// des lignes réellement ajoutées ou modifiées par le diff courant — pas sur
// la dette préexistante d'un fichier par ailleurs touché (735 erreurs / 44
// avertissements backend, 32/25 frontend au 2026-08-02, bien trop pour être
// résorbés d'un coup). Voir .github/workflows/ci.yml.
//
// eslint-plugin-prettier est activé dans la config eslint des deux paquets :
// les problèmes de formatage Prettier remontent donc aussi via ce script
// (règle `prettier/prettier`), pas besoin d'un check Prettier séparé.
//
// Usage (exécuté depuis backend/ ou frontend/, cwd = racine du paquet) :
//   node ../scripts/lint-diff.mjs <base-sha> <head-sha> <ext...>
//   ex: node ../scripts/lint-diff.mjs abc123 def456 .ts .tsx

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const [baseSha, headSha, ...exts] = process.argv.slice(2);
if (!baseSha || !headSha || exts.length === 0) {
  console.error('Usage: lint-diff.mjs <base-sha> <head-sha> <ext...>');
  process.exit(2);
}

const packageDir = process.cwd();
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
const prefix = `${path.relative(repoRoot, packageDir)}/`;

const pathspecs = exts.map((ext) => `*${ext}`);
const changedRaw = execFileSync(
  'git',
  [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    baseSha,
    headSha,
    '--',
    ...pathspecs,
  ],
  { cwd: repoRoot, encoding: 'utf8' },
).trim();

const changedFiles = changedRaw
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => f.startsWith(prefix))
  .map((f) => f.slice(prefix.length))
  .filter(Boolean);

if (changedFiles.length === 0) {
  console.log('Aucun fichier concerné modifié par ce diff — rien à vérifier.');
  process.exit(0);
}

function addedLineRanges(file) {
  const diffText = execFileSync(
    'git',
    ['diff', '-U0', baseSha, headSha, '--', prefix + file],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const ranges = [];
  const hunkRe = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let match;
  while ((match = hunkRe.exec(diffText)) !== null) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count > 0) ranges.push([start, start + count - 1]);
  }
  return ranges;
}

const rangesByFile = new Map(changedFiles.map((f) => [f, addedLineRanges(f)]));

let eslintResults;
try {
  const out = execFileSync('npx', ['eslint', '--format=json', ...changedFiles], {
    cwd: packageDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  });
  eslintResults = JSON.parse(out);
} catch (err) {
  if (!err.stdout) throw err;
  eslintResults = JSON.parse(err.stdout);
}

let newIssueCount = 0;
for (const fileResult of eslintResults) {
  const relFile = path.relative(packageDir, fileResult.filePath);
  const ranges = rangesByFile.get(relFile) || [];
  const newMessages = fileResult.messages.filter((m) =>
    ranges.some(([start, end]) => m.line >= start && m.line <= end),
  );
  for (const m of newMessages) {
    newIssueCount += 1;
    const severity = m.severity === 2 ? 'error' : 'warning';
    console.log(
      `${relFile}:${m.line}:${m.column} ${severity} ${m.message} (${m.ruleId ?? ''})`,
    );
  }
}

if (newIssueCount > 0) {
  console.error(
    `\n${newIssueCount} problème(s) ESLint sur des lignes ajoutées/modifiées par ce diff.`,
  );
  process.exit(1);
}

console.log('Aucun nouveau problème ESLint sur les lignes modifiées par ce diff.');
