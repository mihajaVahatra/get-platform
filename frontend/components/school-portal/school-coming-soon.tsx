import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRightIcon } from 'lucide-react';

export function SchoolComingSoon({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="mx-auto max-w-[900px]">
      <section className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Icon className="size-7" /></span>
        <h1 className="mt-5 text-xl font-extrabold text-[#17204e]">{title}</h1>
        <p className="mt-3 text-sm font-semibold text-slate-700">Cet espace n’est pas encore connecté.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">La navigation est prête ; les données et actions de cette section seront ajoutées dans une prochaine livraison.</p>
        <Link href="/dashboard/school" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-violet-600">Retour au tableau de bord <ChevronRightIcon className="size-4" /></Link>
      </section>
    </div>
  );
}
