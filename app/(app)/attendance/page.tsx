import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { Button, SelectField } from '@/components/ui';
import { dayDateSw, todayTZ } from '@/lib/format';
import { AttendanceForm } from './attendance-form';

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  await requireSession(['admin', 'teacher']);
  const supabase = await createClient();
  const today = todayTZ();
  // Teachers only get the classes they are assigned to (enforced by the database)
  const { data: classes } = await supabase.from('classes').select('id, name').order('sort_order');
  const list = classes ?? [];
  const params = await searchParams;
  const classId = list.some((c) => c.id === params.class) ? params.class : list[0]?.id;
  const current = list.find((c) => c.id === classId);

  const [{ data: students }, { data: marks }] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name').eq('class_id', classId ?? '').eq('status', 'active').order('first_name'),
    supabase.from('attendance').select('student_id, status').eq('class_id', classId ?? '').eq('date', today),
  ]);

  return (
    <main className="page" style={{ maxWidth: 640 }}>
      <div className="page-head"><div><h1>{current?.name ?? 'Darasa'} · Mahudhurio</h1><p>{dayDateSw(new Date(today))}</p></div></div>
      <form className="filters">
        <SelectField label="Darasa" name="class" defaultValue={classId} options={list.map((c) => ({ value: c.id, label: c.name }))} />
        <Button type="submit" variant="outline">Fungua</Button>
      </form>
      {!list.length && <p className="panel empty">Bado hujapangiwa darasa. Wasiliana na mkuu wa shule.</p>}
      {classId && (
        <AttendanceForm
          key={classId}
          classId={classId}
          date={today}
          students={(students ?? []).map((st) => ({
            id: st.id,
            name: `${st.first_name} ${st.last_name}`,
            status: (marks?.find((m) => m.student_id === st.id)?.status ?? 'present') as 'present' | 'late' | 'absent',
          }))}
          alreadySaved={!!marks?.length}
        />
      )}
    </main>
  );
}
