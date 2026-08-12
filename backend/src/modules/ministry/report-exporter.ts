import { ExportFormat } from './dto/report-request.dto';

type ReportForExport = {
  name: string;
  description: string | null;
  type: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  data: unknown;
};

export type ReportExport = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

type ReportRow = [
  section: string,
  indicator: string,
  dimension: string,
  value: string,
];

/**
 * Construit des exports locaux valides à partir d'un instantané agrégé du
 * rapport. Les lignes ne sont jamais alimentées par une identité étudiante :
 * le service Ministry ne stocke que des compteurs par établissement/filière.
 */
export function createReportExport(
  report: ReportForExport,
  format: ExportFormat,
): ReportExport {
  const rows = toReportRows(report);

  switch (format) {
    case ExportFormat.JSON:
      return {
        buffer: Buffer.from(
          JSON.stringify(
            {
              report: reportMetadata(report),
              data: report.data,
            },
            null,
            2,
          ),
          'utf8',
        ),
        contentType: 'application/json; charset=utf-8',
        extension: 'json',
      };
    case ExportFormat.CSV:
      return {
        buffer: Buffer.from(toCsv(rows), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
      };
    case ExportFormat.EXCEL:
      return {
        buffer: Buffer.from(toSpreadsheetMl(rows), 'utf8'),
        contentType: 'application/vnd.ms-excel; charset=utf-8',
        extension: 'xls',
      };
    case ExportFormat.PDF:
    default:
      return {
        buffer: createPdf(report, rows),
        contentType: 'application/pdf',
        extension: 'pdf',
      };
  }
}

/** Métadonnées d'un rapport (hors `data`) sérialisables telles quelles dans l'export JSON. */
function reportMetadata(report: ReportForExport) {
  return {
    name: report.name,
    description: report.description,
    type: report.type,
    period: report.period,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    generatedAt: report.generatedAt.toISOString(),
  };
}

/**
 * Convertit un rapport (métadonnées + instantané JSON `data` arbitrairement
 * imbriqué) en lignes tabulaires plates (section / indicateur / dimension /
 * valeur), format commun aux exports CSV, Excel et PDF.
 */
function toReportRows(report: ReportForExport): ReportRow[] {
  const rows: ReportRow[] = [
    ['Rapport', 'Nom', '', report.name],
    ['Rapport', 'Type', '', report.type],
    [
      'Rapport',
      'Période',
      '',
      `${formatDate(report.periodStart)} — ${formatDate(report.periodEnd)}`,
    ],
    ['Rapport', 'Généré le', '', formatDate(report.generatedAt)],
  ];
  if (report.description)
    rows.push(['Rapport', 'Description', '', report.description]);

  flatten(report.data, [], rows);
  return rows;
}

/**
 * Parcourt récursivement l'instantané JSON du rapport et pousse une ligne
 * par valeur scalaire rencontrée. Les tableaux d'objets (listes d'agrégats)
 * sont traités ligne par ligne via `appendAggregateRow` plutôt que d'être
 * aplatis champ par champ.
 */
function flatten(value: unknown, path: string[], rows: ReportRow[]) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (isRecord(item)) {
        appendAggregateRow(item, path, rows);
      } else {
        flatten(item, path, rows);
      }
    }
    return;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, [...path, humanize(key)], rows);
    }
    return;
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return;
  }

  const [section = 'Synthèse', ...indicatorPath] = path;
  rows.push([
    section,
    indicatorPath.join(' › ') || section,
    '',
    formatScalar(value),
  ]);
}

/**
 * Transforme un objet d'agrégat (ex. `{ school, region, count,
 * acceptedCount }`) en une ou plusieurs lignes : les champs numériques
 * deviennent des mesures (une ligne par mesure), les champs texte/booléens
 * sont regroupés comme dimensions descriptives communes à ces lignes.
 */
function appendAggregateRow(
  row: Record<string, unknown>,
  path: string[],
  rows: ReportRow[],
) {
  const dimensions: string[] = [];
  const measurements: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'number') {
      measurements.push([humanize(key), formatScalar(value)]);
    } else if (typeof value === 'string' || typeof value === 'boolean') {
      dimensions.push(`${humanize(key)}: ${formatScalar(value)}`);
    }
  }

  const [section = 'Synthèse', ...indicatorPath] = path;
  const indicator = indicatorPath.join(' › ') || section;
  if (measurements.length === 0) {
    rows.push([section, indicator, dimensions.join(' · '), '']);
    return;
  }
  for (const [name, value] of measurements) {
    rows.push([
      section,
      `${indicator} › ${name}`,
      dimensions.join(' · '),
      value,
    ]);
  }
}

/** S\u00E9rialise les lignes en CSV (s\u00E9parateur `;`), avec BOM UTF-8 pour un affichage correct des accents dans Excel. */
function toCsv(rows: ReportRow[]) {
  const header = ['Section', 'Indicateur', 'Dimension', 'Valeur'];
  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n')}\n`;
}

/** S\u00E9rialise les lignes en XML SpreadsheetML (feuille de calcul Excel), sans d\u00E9pendance externe. */
function toSpreadsheetMl(rows: ReportRow[]) {
  const allRows = [['Section', 'Indicateur', 'Dimension', 'Valeur'], ...rows];
  const cells = allRows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (value) =>
              `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`,
          )
          .join('')}</Row>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Rapport"><Table>${cells}</Table></Worksheet>
</Workbook>`;
}

/**
 * Génère un PDF minimal fait à la main (sans dépendance externe), limité aux
 * ~31 premières lignes de contenu (au-delà de l'en-tête) sur une seule page
 * A4, avec les caractères non-ASCII translittérés (voir `toAscii`) car
 * l'encodage utilisé (WinAnsi/Helvetica de base) ne gère pas correctement
 * tous les accents.
 */
function createPdf(report: ReportForExport, rows: ReportRow[]) {
  const lines = [
    report.name,
    `${report.type} · ${formatDate(report.periodStart)} — ${formatDate(report.periodEnd)}`,
    '',
    ...rows.slice(4, 35).map(([section, indicator, dimension, value]) => {
      const context = dimension ? ` (${dimension})` : '';
      return `${section} — ${indicator}${context}: ${value}`;
    }),
  ].flatMap((line) => wrapPdfLine(line, 92));

  const commands = [
    'BT',
    '/F1 10 Tf',
    '42 800 Td',
    ...lines.flatMap((line, index) => [
      `(${escapePdfText(line)}) Tj`,
      ...(index < lines.length - 1 ? ['0 -15 Td'] : []),
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(commands, 'latin1')} >>\nstream\n${commands}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}

/** Découpe une ligne de texte en plusieurs lignes ne dépassant pas `width` caractères, sans jamais couper un mot. */
function wrapPdfLine(line: string, width: number) {
  const words = toAscii(line).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Échappe une valeur pour l'inclure entre guillemets dans une cellule CSV,
 * et neutralise l'injection de formule (CSV/DDE) : Excel/LibreOffice
 * interprètent comme une formule toute cellule commençant par =, +, - ou @
 * (recommandation OWASP CSV Injection) — préfixe apostrophe pour forcer
 * l'interprétation en texte brut (faille corrigée suite à l'audit sécurité).
 */
function escapeCsv(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Échappe les caractères spéciaux XML pour une insertion sûre dans le SpreadsheetML. */
function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapePdfText(value: string) {
  return toAscii(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function toAscii(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatScalar(value: string | number | boolean) {
  if (typeof value === 'number')
    return new Intl.NumberFormat('fr-FR').format(value);
  return String(value);
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}
