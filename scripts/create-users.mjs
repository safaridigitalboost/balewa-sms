// Creates the starter logins for Balewa (one per role) plus one demo student linked to the parent.
// Run once AFTER the migration and seed:   node scripts/create-users.mjs
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Supabase > Settings > API).
// The service role key bypasses all security: keep it only in .env.local, never in the browser or on GitHub.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Minimal .env.local reader (no extra package needed)
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* fall back to real environment variables */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const SCHOOL = '00000000-0000-0000-0000-000000000001';

// Starter accounts. CHANGE THESE PASSWORDS after the first login (Supabase > Authentication > Users).
const USERS = [
  { email: 'mkuu@balewa.test', password: 'Balewa-Admin-2026', full_name: 'Mwalimu Mkuu', role: 'admin' },
  { email: 'mhasibu@balewa.test', password: 'Balewa-Bursar-2026', full_name: 'Mhasibu', role: 'bursar' },
  { email: 'mwalimu@balewa.test', password: 'Balewa-Teacher-2026', full_name: 'Mwl. Rehema', role: 'teacher' },
  { email: 'mzazi@balewa.test', password: 'Balewa-Parent-2026', full_name: 'Mama Neema', role: 'parent', phone: '+255700000001' },
];

const ids = {};
for (const u of USERS) {
  let { data, error } = await db.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
  if (error && /already/i.test(error.message)) {
    const list = await db.auth.admin.listUsers({ perPage: 1000 });
    data = { user: list.data.users.find((x) => x.email === u.email) };
    error = null;
    if (data.user) await db.auth.admin.updateUserById(data.user.id, { password: u.password });
  }
  if (error || !data?.user) { console.error(`✗ ${u.email}: ${error?.message}`); process.exit(1); }
  ids[u.role] = data.user.id;
  const { error: pErr } = await db.from('profiles').upsert({
    id: data.user.id, school_id: SCHOOL, full_name: u.full_name, role: u.role, phone: u.phone ?? null, email: u.email,
  });
  if (pErr) { console.error(`✗ profile ${u.email}: ${pErr.message}`); process.exit(1); }
}

// Teacher is assigned to Std 4 only (needs migration 0002)
const { data: std4cls } = await db.from('classes').select('id').eq('school_id', SCHOOL).eq('name', 'Std 4').single();
const ct = await db.from('class_teachers').upsert({ school_id: SCHOOL, class_id: std4cls.id, teacher_id: ids.teacher, is_class_teacher: true });
if (ct.error) console.warn('! Could not assign Std 4 to the teacher. Run supabase/migrations/0002_users_and_class_teachers.sql first.');

// Demo student + guardian linked to the parent login, billed for the current term
const { data: std4 } = await db.from('classes').select('id').eq('school_id', SCHOOL).eq('name', 'Std 4').single();
const { data: term } = await db.from('terms').select('id, ends_on').eq('school_id', SCHOOL).eq('is_current', true).single();
const { data: fee } = await db.from('fee_items').select('amount').eq('term_id', term.id).eq('level', 'primary');
let { data: student } = await db.from('students').select('id').eq('school_id', SCHOOL).eq('reg_no', 'BAL-DEMO-0001').maybeSingle();
if (!student) {
  ({ data: student } = await db.from('students').insert({
    school_id: SCHOOL, reg_no: 'BAL-DEMO-0001', first_name: 'Neema', last_name: 'Juma', gender: 'female', class_id: std4.id,
  }).select('id').single());
  const { data: g } = await db.from('guardians').insert({
    school_id: SCHOOL, full_name: 'Mama Neema', phone: '+255700000001', relationship: 'Mama', profile_id: ids.parent,
  }).select('id').single();
  await db.from('student_guardians').insert({ student_id: student.id, guardian_id: g.id });
  const amount = (fee ?? []).reduce((a, f) => a + Number(f.amount), 0);
  if (amount) await db.from('invoices').insert({ school_id: SCHOOL, student_id: student.id, term_id: term.id, amount, due_date: term.ends_on });
}

console.log('\nAkaunti zimeundwa. Ingia kwenye http://localhost:3000 kwa:\n');
console.table(USERS.map(({ role, email, password }) => ({ role, email, password })));
console.log('\nBadilisha nenosiri hizi kabla ya kumpa mtu yeyote mfumo.\n');
