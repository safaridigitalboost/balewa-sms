import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Role = 'admin' | 'bursar' | 'teacher' | 'parent';

export type Session = {
  userId: string;
  fullName: string;
  role: Role;
  school: { id: string; name: string; motto: string | null; phone: string | null; logo_url: string | null };
};

/** Signed-in user's profile and school. Redirects to /login when missing. */
export async function requireSession(allowed?: Role[]): Promise<Session> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, school:schools(id, name, motto, phone, logo_url)')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.school) redirect('/login?error=no-profile');
  const role = profile.role as Role;
  if (allowed && !allowed.includes(role)) redirect('/dashboard');

  const school = Array.isArray(profile.school) ? profile.school[0] : profile.school;
  return { userId: user.id, fullName: profile.full_name, role, school };
}

export async function currentTerm(schoolId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('terms')
    .select('id, name, year, ends_on')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle();
  return data;
}
