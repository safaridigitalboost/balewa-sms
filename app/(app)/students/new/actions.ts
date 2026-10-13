'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentTerm, requireSession } from '@/lib/session';
import { normalisePhone, tsh } from '@/lib/format';

export type EnrolState = { errors?: Record<string, string>; message?: string };

export async function enrolStudent(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const s = await requireSession(['admin', 'bursar']);
  const supabase = await createClient();
  const f = (k: string) => String(formData.get(k) ?? '').trim();

  const errors: Record<string, string> = {};
  if (!f('first_name')) errors.first_name = 'Weka jina la kwanza';
  if (!f('last_name')) errors.last_name = 'Weka jina la ukoo';
  if (!f('class_id')) errors.class_id = 'Chagua darasa';
  if (!f('guardian_name')) errors.guardian_name = 'Weka jina la mzazi au mlezi';
  const phone = normalisePhone(f('guardian_phone'));
  if (!phone) errors.guardian_phone = 'Weka namba sahihi, mf. 0712 964 348';
  if (Object.keys(errors).length) return { errors };

  const year = new Date().getFullYear();
  const { data: regNo, error: regErr } = await supabase.rpc('next_reg_no', { p_school: s.school.id, p_year: year });
  if (regErr) return { message: 'Imeshindikana kutengeneza namba ya usajili. Jaribu tena.' };

  const { data: student, error: stErr } = await supabase.from('students').insert({
    school_id: s.school.id, reg_no: regNo, first_name: f('first_name'), middle_name: f('middle_name') || null,
    last_name: f('last_name'), date_of_birth: f('date_of_birth') || null, gender: f('gender') || null,
    class_id: f('class_id'), previous_school: f('previous_school') || null,
  }).select('id, class:classes(level)').single();
  if (stErr || !student) return { message: 'Imeshindikana kuhifadhi mwanafunzi. Jaribu tena.' };

  // Reuse a guardian already registered with this phone (siblings share parents)
  let { data: guardian } = await supabase.from('guardians').select('id').eq('phone', phone!).maybeSingle();
  if (!guardian) {
    const res = await supabase.from('guardians').insert({
      school_id: s.school.id, full_name: f('guardian_name'), phone, relationship: f('relationship') || 'Mama', address: f('address') || null,
    }).select('id').single();
    guardian = res.data;
  }
  if (guardian) await supabase.from('student_guardians').insert({ student_id: student.id, guardian_id: guardian.id });

  // Bill the current term for the student's level
  const term = await currentTerm(s.school.id);
  const level = (Array.isArray(student.class) ? student.class[0] : student.class)?.level;
  if (term && level) {
    const { data: items } = await supabase.from('fee_items').select('amount').eq('term_id', term.id).eq('level', level);
    const amount = (items ?? []).reduce((a, i) => a + Number(i.amount), 0);
    if (amount > 0) {
      await supabase.from('invoices').insert({ school_id: s.school.id, student_id: student.id, term_id: term.id, amount, due_date: term.ends_on });
      await supabase.from('sms_messages').insert({
        school_id: s.school.id, to_phone: phone, purpose: 'enrolment', created_by: s.userId,
        body: `Karibu ${s.school.name}. ${f('first_name')} amesajiliwa (${regNo}). Ada ya ${term.name}: ${tsh(amount)}.`,
      });
    }
  }
  redirect(`/students?created=${encodeURIComponent(String(regNo))}`);
}
