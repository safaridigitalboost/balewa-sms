'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';

type Mark = { studentId: string; status: 'present' | 'late' | 'absent' };

export async function saveAttendance(classId: string, date: string, marks: Mark[]) {
  const s = await requireSession(['admin', 'teacher']);
  const supabase = await createClient();
  const valid = new Set(['present', 'late', 'absent']);
  const rows = marks.filter((m) => valid.has(m.status)).map((m) => ({
    school_id: s.school.id, student_id: m.studentId, class_id: classId, date, status: m.status,
    marked_by: s.userId, marked_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
  if (error) return { ok: false as const, message: 'Imeshindikana kuhifadhi. Jaribu tena.' };

  // Queue an SMS to the primary guardian of each absent child (sent by the SMS worker in a later phase)
  const absent = rows.filter((r) => r.status === 'absent').map((r) => r.student_id);
  let queued = 0;
  if (absent.length) {
    const { data } = await supabase.from('students')
      .select('first_name, student_guardians(is_primary, guardian:guardians(phone))').in('id', absent);
    const sms = (data ?? []).flatMap((st) => {
      const g = st.student_guardians?.find((x) => x.is_primary) ?? st.student_guardians?.[0];
      const guardian = g ? (Array.isArray(g.guardian) ? g.guardian[0] : g.guardian) : null;
      return guardian?.phone ? [{
        school_id: s.school.id, to_phone: guardian.phone, purpose: 'absence', created_by: s.userId,
        body: `${s.school.name}: ${st.first_name} hakuhudhuria shuleni leo (${date}). Kwa maswali piga ${s.school.phone ?? 'ofisi ya shule'}.`,
      }] : [];
    });
    if (sms.length) { await supabase.from('sms_messages').insert(sms); queued = sms.length; }
  }
  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { ok: true as const, queued };
}
