// Demo data for every screen: ~85 students across all 11 classes, guardians, term invoices,
// a realistic mix of payments, 10 school days of attendance and some SMS.
// Run AFTER the migration, seed.sql and scripts/create-users.mjs:   node scripts/seed-demo.mjs
// Run again to rebuild it. Remove it with:                          node scripts/seed-demo.mjs --remove
// Demo records are recognised by guardian phones starting +25570000 — real data is never touched.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* use real env */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const SCHOOL = '00000000-0000-0000-0000-000000000001';
const DEMO_PHONE = '+25570000';

const must = (res, what) => { if (res.error) { console.error(`✗ ${what}: ${res.error.message}`); process.exit(1); } return res.data; };

// Deterministic pseudo-random so every run gives the same demo
let seed = 20261013;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---------- Remove previous demo ----------
// Guardians with a login (e.g. the demo parent account) are left alone
const demoGuardians = must(await db.from('guardians').select('id').eq('school_id', SCHOOL).like('phone', DEMO_PHONE + '%').is('profile_id', null), 'read demo guardians');
if (demoGuardians.length) {
  const links = must(await db.from('student_guardians').select('student_id').in('guardian_id', demoGuardians.map((g) => g.id)), 'read links');
  const sids = [...new Set(links.map((l) => l.student_id))];
  for (let i = 0; i < sids.length; i += 100) must(await db.from('students').delete().in('id', sids.slice(i, i + 100)), 'delete demo students');
  must(await db.from('guardians').delete().in('id', demoGuardians.map((g) => g.id)), 'delete demo guardians');
  must(await db.from('sms_messages').delete().eq('school_id', SCHOOL).like('to_phone', DEMO_PHONE + '%'), 'delete demo sms');
  console.log(`Removed previous demo: ${sids.length} students, ${demoGuardians.length} guardians.`);
}
if (process.argv.includes('--remove')) { console.log('Demo data removed.'); process.exit(0); }

// ---------- Lookups ----------
const classes = must(await db.from('classes').select('id, name, level').eq('school_id', SCHOOL).order('sort_order'), 'classes');
const term = must(await db.from('terms').select('id, name, starts_on, ends_on').eq('school_id', SCHOOL).eq('is_current', true).single(), 'current term');
const fees = must(await db.from('fee_items').select('level, amount').eq('term_id', term.id), 'fee items');
const feeFor = (lv) => fees.filter((f) => f.level === lv).reduce((a, f) => a + Number(f.amount), 0);
const staff = must(await db.from('profiles').select('id, role').eq('school_id', SCHOOL).in('role', ['admin', 'bursar', 'teacher']), 'staff');
const bursar = staff.find((p) => p.role === 'bursar')?.id ?? staff[0]?.id ?? null;
const teacher = staff.find((p) => p.role === 'teacher')?.id ?? staff[0]?.id ?? null;

// ---------- Names ----------
const GIRLS = ['Neema', 'Amina', 'Rehema', 'Zawadi', 'Grace', 'Faraja', 'Lightness', 'Zuhura', 'Mwanaisha', 'Upendo', 'Glory', 'Halima', 'Sabra', 'Witness', 'Agape', 'Joyce', 'Salma', 'Esther', 'Rahma', 'Imani'];
const BOYS = ['Baraka', 'Said', 'Daudi', 'Joseph', 'Hamisi', 'Issa', 'Peter', 'Yusuph', 'Brian', 'Emmanuel', 'Omari', 'Juma', 'Elia', 'Rashidi', 'Godfrey', 'Abdallah', 'Frank', 'Ally', 'Kelvin', 'Ibrahim'];
const SURNAMES = ['Mushi', 'Mrema', 'Lyimo', 'Kimaro', 'Massawe', 'Swai', 'Mollel', 'Mallya', 'Hassan', 'Omari', 'Mwinyi', 'Kassim', 'Ngowi', 'Shirima', 'Temba', 'Mbwambo', 'Kweka', 'Minja', 'Urio', 'Makundi', 'Mwakyusa', 'Chande'];
const PARENT_F = ['Mama', 'Mama', 'Baba', 'Mlezi'];

// ---------- Students & guardians ----------
const perClass = { 'Day Care': 6 };
const year = new Date(Date.now() + 3 * 3600e3).getUTCFullYear();
const ageFor = { 'Day Care': 2, 'Baby Class': 3, 'Middle Class': 4, 'Top Class': 5 };
let n = 1, phoneN = 100; // phones +255700000100…; 0001 is the demo parent login
const plan = [];
for (const c of classes) {
  const count = perClass[c.name] ?? 8;
  for (let i = 0; i < count; i++) {
    const girl = rnd() < 0.5, last = pick(SURNAMES);
    const age = ageFor[c.name] ?? 5 + Number((c.name.match(/\d+/) ?? ['1'])[0]);
    const dob = new Date(Date.UTC(year - age, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))).toISOString().slice(0, 10);
    // ~1 in 8 children is a sibling of the previous one (same guardian)
    const sibling = plan.length && rnd() < 0.12 ? plan[plan.length - 1].guardian : null;
    const rel = pick(PARENT_F);
    const guardian = sibling ?? {
      full_name: `${rel === 'Baba' ? pick(BOYS) : pick(GIRLS)} ${last}`, relationship: rel,
      phone: `${DEMO_PHONE}${String(phoneN++).padStart(4, '0')}`, address: pick(['Kibamba', 'Mng’ongoni', 'Mbezi', 'Kiluvya', 'Goba', 'Kimara']),
    };
    plan.push({
      student: { school_id: SCHOOL, reg_no: `BAL-${year}-${String(n++).padStart(4, '0')}`, first_name: girl ? pick(GIRLS) : pick(BOYS),
        last_name: sibling ? sibling.full_name.split(' ').pop() : last, gender: girl ? 'female' : 'male', date_of_birth: dob,
        class_id: c.id, admitted_on: `${year - Math.min(age - 2, 3)}-01-10` },
      guardian, level: c.level, className: c.name,
    });
  }
}
// Avoid clashing with reg numbers that already exist
const taken = new Set(must(await db.from('students').select('reg_no').eq('school_id', SCHOOL), 'existing reg').map((s) => s.reg_no));
for (const p of plan) while (taken.has(p.student.reg_no)) p.student.reg_no = `BAL-${year}-${String(n++).padStart(4, '0')}`;

const uniqueG = [...new Set(plan.map((p) => p.guardian))];
const gRows = must(await db.from('guardians').insert(uniqueG.map((g) => ({ school_id: SCHOOL, ...g }))).select('id, phone'), 'insert guardians');
const gId = new Map(gRows.map((g) => [g.phone, g.id]));
const sRows = must(await db.from('students').insert(plan.map((p) => p.student)).select('id, reg_no'), 'insert students');
const sId = new Map(sRows.map((s) => [s.reg_no, s.id]));
must(await db.from('student_guardians').insert(plan.map((p) => ({ student_id: sId.get(p.student.reg_no), guardian_id: gId.get(p.guardian.phone) }))), 'link guardians');

// ---------- Invoices & payments ----------
const invRows = must(await db.from('invoices').insert(plan.map((p) => ({
  school_id: SCHOOL, student_id: sId.get(p.student.reg_no), term_id: term.id, amount: feeFor(p.level), due_date: term.ends_on,
  control_number: `9912${10000000 + Math.floor(rnd() * 89999999)}`,
}))).select('id, student_id, amount'), 'insert invoices');

const termStart = new Date(term.starts_on + 'T00:00:00Z').getTime();
const today = Date.now();
const payments = [];
let ref = 1;
for (const inv of invRows) {
  const amt = Number(inv.amount), r = rnd();
  const parts = r < 0.45 ? [amt] : r < 0.6 ? [Math.round(amt / 2 / 1000) * 1000, amt - Math.round(amt / 2 / 1000) * 1000]
    : r < 0.85 ? [Math.round((amt * (0.3 + rnd() * 0.4)) / 10000) * 10000] : [];
  for (const a of parts) {
    const method = pick(['mpesa', 'mpesa', 'mpesa', 'mixx', 'airtel', 'bank', 'cash']);
    const at = new Date(termStart + rnd() * (today - termStart));
    payments.push({ school_id: SCHOOL, invoice_id: inv.id, amount: a, method, recorded_by: bursar, paid_at: at.toISOString(),
      reference: method === 'cash' ? null : `DEMO${String(ref++).padStart(6, '0')}` });
  }
}
must(await db.from('payments').insert(payments), 'insert payments');

// ---------- Attendance: last 10 school days ----------
const days = [];
for (let d = new Date(today + 3 * 3600e3); days.length < 10; d = new Date(d.getTime() - 86400e3)) {
  const wd = d.getUTCDay();
  if (wd !== 0 && wd !== 6) days.push(d.toISOString().slice(0, 10));
}
const att = [];
for (const day of days) for (const p of plan) {
  const r = rnd();
  att.push({ school_id: SCHOOL, student_id: sId.get(p.student.reg_no), class_id: p.student.class_id, date: day, marked_by: teacher,
    status: r < 0.9 ? 'present' : r < 0.95 ? 'late' : 'absent' });
}
// Leave today's attendance unmarked for two classes so the dashboard shows the reminder
const todayStr = days[0];
const skip = new Set(classes.filter((c) => ['Std 3', 'Middle Class'].includes(c.name)).map((c) => c.id));
const attRows = att.filter((a) => !(a.date === todayStr && skip.has(a.class_id)));
for (let i = 0; i < attRows.length; i += 500) must(await db.from('attendance').upsert(attRows.slice(i, i + 500), { onConflict: 'student_id,date' }), 'attendance');

// ---------- SMS log ----------
const absentees = attRows.filter((a) => a.status === 'absent').slice(0, 12);
const sms = absentees.map((a) => {
  const p = plan.find((x) => sId.get(x.student.reg_no) === a.student_id);
  return { school_id: SCHOOL, to_phone: p.guardian.phone, purpose: 'absence', status: 'sent', created_by: teacher,
    body: `Balewa Nursery & Primary School: ${p.student.first_name} hakuhudhuria shuleni ${a.date}.` };
});
if (sms.length) must(await db.from('sms_messages').insert(sms), 'sms');

const paid = payments.reduce((s, p) => s + p.amount, 0), billed = invRows.reduce((s, i) => s + Number(i.amount), 0);
console.log(`\nDemo data imeingizwa:
  Wanafunzi:  ${sRows.length} (madarasa ${classes.length})
  Wazazi:     ${gRows.length}
  Bili:       ${invRows.length} · TSh ${billed.toLocaleString('en-US')}
  Malipo:     ${payments.length} · TSh ${paid.toLocaleString('en-US')} (${Math.round((paid / billed) * 100)}%)
  Mahudhurio: siku ${days.length} · rekodi ${attRows.length}
  SMS:        ${sms.length}
Ondoa demo: node scripts/seed-demo.mjs --remove\n`);
