import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { Button, LevelTag, SelectField, type Level } from '@/components/ui';

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ class?: string; q?: string; created?: string }> }) {
  const s = await requireSession(['admin', 'bursar', 'teacher']);
  const { class: classId, q, created } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await supabase.from('classes').select('id, name, level').order('sort_order');
  let query = supabase.from('students')
    .select('id, reg_no, first_name, middle_name, last_name, gender, class:classes(name, level), student_guardians(guardian:guardians(full_name, phone))')
    .eq('status', 'active').order('first_name');
  if (classId) query = query.eq('class_id', classId);
  // Strip characters that have meaning in PostgREST filter syntax before searching
  const term = (q ?? '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
  if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,reg_no.ilike.%${term}%`);
  const { data: students } = await query;

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Wanafunzi</h1><p>{students?.length ?? 0} wanafunzi</p></div>
        {s.role !== 'teacher' && <Link href="/students/new"><Button>+ Sajili mwanafunzi</Button></Link>}
      </div>
      {created && <p className="notice notice-ok" role="status">Usajili umehifadhiwa: {created}</p>}
      <form className="filters">
        <SelectField label="Darasa" name="class" defaultValue={classId ?? ''}
          options={[{ value: '', label: 'Madarasa yote' }, ...(classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        <div className="bw-field"><label className="bw-field-label" htmlFor="q">Tafuta</label>
          <input id="q" name="q" className="bw-input" defaultValue={q ?? ''} placeholder="Jina au namba ya usajili" /></div>
        <Button type="submit" variant="outline">Chuja</Button>
      </form>
      <section className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Namba</th><th>Jina</th><th>Darasa</th><th>Mzazi / mlezi</th><th>Simu</th></tr></thead>
          <tbody>
            {(students ?? []).map((st) => {
              const c = (Array.isArray(st.class) ? st.class[0] : st.class) as { name: string; level: Level } | null;
              const g0 = st.student_guardians?.[0]?.guardian;
              const g = (Array.isArray(g0) ? g0[0] : g0) as { full_name: string; phone: string } | undefined;
              return (
                <tr key={st.id}>
                  <td>{st.reg_no}</td>
                  <td><b>{[st.first_name, st.middle_name, st.last_name].filter(Boolean).join(' ')}</b></td>
                  <td>{c && <LevelTag level={c.level}>{c.name}</LevelTag>}</td>
                  <td>{g?.full_name}</td>
                  <td>{g?.phone}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!students?.length && <p className="empty">Hakuna mwanafunzi aliyepatikana.</p>}
      </section>
    </main>
  );
}
