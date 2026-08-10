'use client';

import { usePathname } from 'next/navigation';

/**
 * Layout partagé par toutes les pages sous `/auth/*`.
 *
 * Les pages login/register gèrent déjà leur propre mise en page plein écran
 * (via `LoginScreen`), donc ce layout ne leur applique pas le conteneur
 * centré générique — sinon leur contenu se retrouverait doublement contraint.
 * Les autres pages (mot de passe oublié, réinitialisation, vérification
 * d'email, ...) sont centrées verticalement dans une carte de largeur max `md`.
 *
 * @param children - Contenu de la page d'authentification active.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/auth/login' || pathname === '/auth/register') return children;
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="mx-4 w-full max-w-md">{children}</div></div>;
}
