import { requireSession, type Role } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersManager, type UserRow } from './users-manager';

export default async function UsersPage() {
  const s = await requireSession(['admin']);
  const db = createAdminClient();   // admin verified above; every query is scoped to this school
  const [{ data: profiles }, { data: classes }, { data: ct }] = await Promise.all([
    db.from('profiles').select('id, full_name, role, phone, email, active, created_at').eq('school_id', s.school.id).order('full_name'),
    db.from('classes').select('id, name, level').eq('school_id', s.school.id).order('sort_order'),
    db.from('class_teachers').select('teacher_id, class_id').eq('school_id', s.school.id),
  ]);
  const users: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id, fullName: p.full_name, role: p.role as Role, phone: p.phone, email: p.email, active: p.active,
    classIds: (ct ?? []).filter((x) => x.teacher_id === p.id).map((x) => x.class_id), isMe: p.id === s.userId,
  }));
  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Watumiaji</h1><p>Ongeza walimu, mhasibu na wazazi. Walimu wanaona madarasa waliyopangiwa tu.</p></div>
      </div>
      <UsersManager users={users} classes={classes ?? []} />
    </main>
  );
}
