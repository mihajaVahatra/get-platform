'use client';

import { usePathname } from 'next/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/auth/login' || pathname === '/auth/register') return children;
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="mx-4 w-full max-w-md">{children}</div></div>;
}
