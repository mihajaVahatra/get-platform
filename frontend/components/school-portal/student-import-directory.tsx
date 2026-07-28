'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
  Edit3,
  FileUp,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react';
import {
  Person,
  ProfileModal,
} from '@/components/school-portal/people-directory';

const initialStudents: Person[] = [
  {
    id: 'GET2024-INFO-1024',
    name: 'Rasolonjatoavo Tina',
    program: 'Informatique',
    level: 'Licence 1',
    email: 'tina.raso@gmail.com',
    phone: '034 12 345 67',
    status: 'Actif',
  },
  {
    id: 'GET2024-GC-1031',
    name: 'Rakotoarivelo Miora',
    program: 'Génie Civil',
    level: 'Licence 1',
    email: 'miora.rakoto@gmail.com',
    phone: '034 56 789 01',
    status: 'Actif',
  },
  {
    id: 'GET2023-MGT-0821',
    name: 'Andriamiadana Fanja',
    program: 'Management',
    level: 'Licence 2',
    email: 'fanja.andria@gmail.com',
    phone: '033 45 678 90',
    status: 'En attente',
  },
  {
    id: 'GET2024-INFO-1112',
    name: 'Rabeharisoa Lova',
    program: 'Informatique',
    level: 'Licence 1',
    email: 'lova.rabe@gmail.com',
    phone: '034 56 789 01',
    status: 'Actif',
  },
];

export function StudentImportDirectory() {
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () =>
      students.filter((student) =>
        `${student.name} ${student.program} ${student.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [students, query],
  );

  const exportExcel = () => {
    const headers = [
      'ID étudiant',
      'Nom complet',
      'Filière',
      'Niveau',
      'Email',
      'Téléphone',
      'Statut',
    ];
    const csv = [
      headers,
      ...students.map((student) => [
        student.id,
        student.name,
        student.program,
        student.level,
        student.email,
        student.phone,
        student.status,
      ]),
    ]
      .map((row) => row.map(escapeCsv).join(';'))
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'liste-etudiants-espa.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('La liste Excel a été téléchargée.');
  };

  const importExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error('Fichier trop volumineux');
      const rows = csvToRows(await file.text());
      const imported = rows
        .map((row, index) => toStudent(row, index))
        .filter((student): student is Person => student !== null);
      if (!imported.length) throw new Error('Aucun étudiant valide trouvé');
      setStudents((current) => {
        const known = new Set(
          current.map((student) => student.email.toLowerCase()),
        );
        const additions = imported.filter(
          (student) => !known.has(student.email.toLowerCase()),
        );
        return [...current, ...additions];
      });
      toast.success(`${imported.length} étudiant(s) importé(s).`);
    } catch {
      toast.error(
        'Le fichier est invalide. Vérifiez les colonnes Nom complet et Email.',
      );
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Étudiants
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Gérez et consultez la liste des étudiants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={importExcel}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2.5 text-xs font-bold text-violet-600 hover:bg-violet-50"
          >
            <FileUp className="size-4" />
            Importer CSV (Excel)
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#34406b] hover:bg-slate-50"
          >
            <Download className="size-4" />
            Exporter CSV (Excel)
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200">
            <Plus className="size-4" />
            Ajouter un étudiant
          </button>
        </div>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <label className="relative min-w-[250px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-violet-500"
              placeholder="Rechercher un étudiant..."
            />
          </label>
          {['Filière', 'Niveau', 'Statut'].map((label) => (
            <button
              key={label}
              className="h-10 min-w-28 rounded-lg border border-slate-200 px-3 text-left text-xs text-slate-500"
            >
              {label}
              <span className="float-right">⌄</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-[11px]">
            <thead className="border-b border-slate-100 text-slate-400">
              <tr>
                {[
                  'Étudiant',
                  'Filière',
                  'Niveau',
                  'Email',
                  'Téléphone',
                  'Statut',
                  'Actions',
                ].map((label) => (
                  <th key={label} className="pb-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => setSelected(student)}
                  className="cursor-pointer border-b border-slate-50 text-slate-600 transition hover:bg-violet-50/50"
                >
                  <td className="py-3 font-bold text-[#28315e]">
                    <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-violet-100 text-[10px] text-violet-600">
                      {student.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                    {student.name}
                  </td>
                  <td>{student.program}</td>
                  <td>{student.level}</td>
                  <td>{student.email}</td>
                  <td>{student.phone}</td>
                  <td>
                    <Status value={student.status} />
                  </td>
                  <td>
                    <div className="flex gap-2 text-violet-600">
                      <Edit3 className="size-4" />
                      <MoreHorizontal className="size-4" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 text-xs text-slate-500">
          {students.length} étudiant(s) affiché(s). Les doublons d’e-mail sont
          ignorés pendant l’import.
        </p>
      </section>
      {selected && (
        <ProfileModal
          kind="student"
          person={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function toStudent(row: Record<string, unknown>, index: number): Person | null {
  const value = (...keys: string[]) =>
    keys
      .map((key) => row[key])
      .find((item) => String(item).trim())
      ?.toString()
      .trim() || '';
  const name = value('Nom complet', 'Étudiant', 'Nom');
  const email = value('Email', 'Adresse e-mail', 'E-mail');
  if (!name || !email) return null;
  return {
    id: value('ID étudiant', 'ID') || `IMPORT-${Date.now()}-${index + 1}`,
    name,
    program: value('Filière', 'Programme') || 'Non renseignée',
    level: value('Niveau') || 'Non renseigné',
    email,
    phone: value('Téléphone', 'Phone') || 'Non renseigné',
    status: value('Statut') || 'Actif',
  };
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function csvToRows(content: string): Record<string, unknown>[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 2001);
  if (lines.length < 2) return [];
  const parse = (line: string) =>
    line
      .match(/("(?:[^"]|"")*"|[^;]*)(?:;|$)/g)
      ?.map((cell) =>
        cell.replace(/;$/, '').replace(/^"|"$/g, '').replaceAll('""', '"'),
      ) || [];
  const headers = parse(lines[0]).map((header) => header.trim());
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(
        parse(line).map((value, index) => [headers[index], value]),
      ),
    );
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-1 text-[10px] font-bold ${value === 'Actif' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}
    >
      {value}
    </span>
  );
}
