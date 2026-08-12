import { ExportFormat } from './dto/report-request.dto';
import { createReportExport } from './report-exporter';

type JsonExport = {
  report: { name: string };
  data: {
    applications: {
      bySchoolProgramme: Array<{
        school: string;
        programme: string;
        count: number;
        acceptedCount: number;
      }>;
    };
  };
};

const report = {
  name: 'Rapport national de janvier',
  description: 'Indicateurs agrégés',
  type: 'NATIONAL',
  period: 'MONTHLY',
  periodStart: new Date('2026-01-01T00:00:00.000Z'),
  periodEnd: new Date('2026-01-31T23:59:59.999Z'),
  generatedAt: new Date('2026-02-01T08:00:00.000Z'),
  data: {
    summary: { totalApplications: 42, totalSchools: 3 },
    applications: {
      bySchoolProgramme: [
        {
          school: 'ENI',
          programme: 'Licence informatique',
          count: 12,
          acceptedCount: 5,
        },
      ],
    },
  },
};

describe('createReportExport', () => {
  it('produit un PDF binaire valide à partir des seuls agrégats', () => {
    const result = createReportExport(report, ExportFormat.PDF);

    expect(result.contentType).toBe('application/pdf');
    expect(result.extension).toBe('pdf');
    expect(result.buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('produit un JSON parseable qui conserve le snapshot agrégé', () => {
    const result = createReportExport(report, ExportFormat.JSON);
    const payload = JSON.parse(result.buffer.toString('utf8')) as JsonExport;

    expect(result.extension).toBe('json');
    expect(payload.report.name).toBe(report.name);
    expect(payload.data.applications.bySchoolProgramme[0]).toEqual({
      school: 'ENI',
      programme: 'Licence informatique',
      count: 12,
      acceptedCount: 5,
    });
  });

  it.each([
    [ExportFormat.CSV, 'csv', 'text/csv; charset=utf-8'],
    [ExportFormat.EXCEL, 'xls', 'application/vnd.ms-excel; charset=utf-8'],
  ])('produit un export %s exploitable', (format, extension, contentType) => {
    const result = createReportExport(report, format);

    expect(result.extension).toBe(extension);
    expect(result.contentType).toBe(contentType);
    expect(result.buffer.toString('utf8')).toContain('ENI');
    expect(result.buffer.toString('utf8')).toContain('Licence informatique');
  });

  it.each(['=', '+', '-', '@'])(
    'neutralise l’injection de formule CSV pour un nom de rapport commençant par "%s"',
    (leadingChar) => {
      // report.name passe tel quel dans une cellule CSV (contrairement aux
      // dimensions bySchoolProgramme, toujours préfixées d'un libellé fixe
      // comme "School: " — jamais exploitables telles quelles) : c'est la
      // seule valeur de ce rapport agrégé qui pourrait littéralement
      // commencer par le caractère déclencheur.
      const maliciousReport = {
        ...report,
        name: `${leadingChar}cmd|'/c calc'!A1`,
      };

      const result = createReportExport(maliciousReport, ExportFormat.CSV);
      const csv = result.buffer.toString('utf8');

      // La cellule est préfixée d'une apostrophe (neutralisation standard
      // OWASP) : elle ne doit plus jamais commencer par le caractère
      // déclencheur juste après un guillemet ouvrant.
      expect(csv).not.toContain(`"${leadingChar}cmd`);
      expect(csv).toContain(`"'${leadingChar}cmd`);
    },
  );
});
