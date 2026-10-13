import { redirect } from 'next/navigation';
import { requireSession, type Role } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { NavLinks } from './nav-links';

export const dynamic = 'force-dynamic';

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['admin', 'bursar', 'teacher', 'parent'] },
  { href: '/students', label: 'Wanafunzi', roles: ['admin', 'bursar', 'teacher'] },
  { href: '/fees', label: 'Ada', roles: ['admin', 'bursar'] },
  { href: '/attendance', label: 'Mahudhurio', roles: ['admin', 'teacher'] },
  { href: '/import', label: 'Import', roles: ['admin', 'bursar'] },
  { href: '/users', label: 'Watumiaji', roles: ['admin'] },
];

const ROLE_SW: Record<Role, string> = { admin: 'Mkuu wa shule', bursar: 'Mhasibu', teacher: 'Mwalimu', parent: 'Mzazi' };

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const links = NAV.filter((n) => n.roles.includes(s.role)).map(({ href, label }) => ({ href, label }));
  return (
    <>
      <header className="shell-top">
        <a href="/dashboard" className="shell-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.school.logo_url ?? '/balewa-crest.png'} alt="" />
          <span><b>{s.school.name}</b><small>{s.school.motto}</small></span>
        </a>
        <NavLinks links={links} />
        <div className="shell-user">
          <span>{s.fullName} · {ROLE_SW[s.role]}</span>
          <form action={signOut}><button type="submit">Toka</button></form>
        </div>
      </header>
      {children}
    </>
  );
}
