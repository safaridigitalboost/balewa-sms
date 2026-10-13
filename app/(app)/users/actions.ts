'use server';
import { revalidatePath } from 'next/cache';
import { requireSession, type Role } from '@/lib/session';
import { createAdminClient, tempPassword } from '@/lib/supabase/admin';
import { normalisePhone } from '@/lib/format';

export type UserResult = { ok: boolean; message: string; password?: string; email?: string };
const ROLES: Role[] = ['admin', 'bursar', 'teacher', 'parent'];

/** The target user must belong to the admin's school. */
async function sameSchool(db: ReturnType<typeof createAdminClient>, schoolId: string, userId: string) {
  const { data } = await db.from('profiles').select('id, role, phone').eq('id', userId).eq('school_id', schoolId).maybeSingle();
  return data;
}

async function validClassIds(db: ReturnType<typeof createAdminClient>, schoolId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data } = await db.from('classes').select('id').eq('school_id', schoolId).in('id', ids);
  return (data ?? []).map((c) => c.id);
}

export async function createUser(_prev: UserResult | null, formData: FormData): Promise<UserResult> {
  const s = await requireSession(['admin']);
  const db = createAdminClient();
  const f = (k: string) => String(formData.get(k) ?? '').trim();
  const role = f('role') as Role;
  const email = f('email').toLowerCase();
  const fullName = f('full_name');
  const phone = f('phone') ? normalisePhone(f('phone')) : null;

  if (!fullName) return { ok: false, message: 'Weka jina kamili.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Weka barua pepe sahihi.' };
  if (!ROLES.includes(role)) return { ok: false, message: 'Chagua jukumu.' };
  if (f('phone') && !phone) return { ok: false, message: 'Namba ya simu si sahihi (mf. 0712 964 348).' };
  if (role === 'parent' && !phone) return { ok: false, message: 'Mzazi anahitaji namba ya simu iliyosajiliwa kwa mwanafunzi.' };

  const password = tempPassword();
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !created.user) {
    return { ok: false, message: /already|registered|exists/i.test(error?.message ?? '') ? 'Barua pepe hii tayari ina akaunti.' : 'Imeshindikana kuunda akaunti. Jaribu tena.' };
  }
  const uid = created.user.id;
  const { error: pErr } = await db.from('profiles').insert({ id: uid, school_id: s.school.id, full_name: fullName, role, phone, email });
  if (pErr) {
    await db.auth.admin.deleteUser(uid);   // don't leave a login without a profile
    return { ok: false, message: 'Imeshindikana kuhifadhi taarifa za mtumiaji.' };
  }

  let note = '';
  if (role === 'teacher') {
    const ids = await validClassIds(db, s.school.id, formData.getAll('class_ids').map(String));
    if (ids.length) await db.from('class_teachers').insert(ids.map((class_id) => ({ school_id: s.school.id, class_id, teacher_id: uid })));
    note = ids.length ? ` Amepangiwa madarasa ${ids.length}.` : ' Bado hajapangiwa darasa.';
  }
  if (role === 'parent') {
    const { data: linked } = await db.from('guardians').update({ profile_id: uid })
      .eq('school_id', s.school.id).eq('phone', phone!).is('profile_id', null).select('id');
    note = linked?.length ? ' Ameunganishwa na watoto wake.' : ' Hakuna mzazi mwenye namba hii kwenye usajili wa wanafunzi bado.';
  }
  revalidatePath('/users');
  return { ok: true, message: `Akaunti ya ${fullName} imeundwa.${note}`, password, email };
}

export async function setTeacherClasses(teacherId: string, classIds: string[]): Promise<UserResult> {
  const s = await requireSession(['admin']);
  const db = createAdminClient();
  const t = await sameSchool(db, s.school.id, teacherId);
  if (!t || t.role !== 'teacher') return { ok: false, message: 'Mwalimu hajapatikana.' };
  const ids = await validClassIds(db, s.school.id, classIds);
  await db.from('class_teachers').delete().eq('teacher_id', teacherId).eq('school_id', s.school.id);
  if (ids.length) await db.from('class_teachers').insert(ids.map((class_id) => ({ school_id: s.school.id, class_id, teacher_id: teacherId })));
  revalidatePath('/users');
  return { ok: true, message: ids.length ? `Madarasa ${ids.length} yamehifadhiwa.` : 'Mwalimu hana darasa kwa sasa.' };
}

export async function resetPassword(userId: string): Promise<UserResult> {
  const s = await requireSession(['admin']);
  const db = createAdminClient();
  if (!(await sameSchool(db, s.school.id, userId))) return { ok: false, message: 'Mtumiaji hajapatikana.' };
  const password = tempPassword();
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: 'Imeshindikana kubadilisha nenosiri.' };
  return { ok: true, message: 'Nenosiri jipya limetengenezwa.', password };
}

export async function setActive(userId: string, active: boolean): Promise<UserResult> {
  const s = await requireSession(['admin']);
  if (userId === s.userId) return { ok: false, message: 'Huwezi kuzima akaunti yako mwenyewe.' };
  const db = createAdminClient();
  if (!(await sameSchool(db, s.school.id, userId))) return { ok: false, message: 'Mtumiaji hajapatikana.' };
  await db.from('profiles').update({ active }).eq('id', userId);
  // Also block sign-in at the auth level
  await db.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });
  revalidatePath('/users');
  return { ok: true, message: active ? 'Akaunti imewashwa.' : 'Akaunti imezimwa.' };
}
