import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { currentTerm, requireSession } from '@/lib/session';
import { Button, FeeCard, LevelTag, StatCard, StatusBadge, type Level } from '@/components/ui';
import { dateSw, dayDateSw, todayTZ, tsh, tshShort } from '@/lib/format';

type ClassRow = { id: string; name: string; level: Level };

export default async function Dashboard() {
  const s = await requireSession();
  const supabase = await createClient();
  const term = await currentTerm(s.school.id);
  const today = todayTZ();

  // ----- Parent view: their children's fees -----
  if (s.role === 'parent') {
    const { data: kids } = await supabase.from('students')
      .select('id, first_name, last_name, class:classes(name, level)').eq('status', 'active');
    const { data: bal } = term
      ? await supabase.from('invoice_balances').select('student_id, amount, paid, due_date, control_number').eq('term_id', term.id)
      : { data: [] };
    return (
      <main className="page" style={{ maxWidth: 520 }}>
        <div className="page-head"><div><h1>Habari, {s.fullName.split(' ')[0]}</h1><p>{term ? `${term.name} · ${term.year}` : ''}</p></div></div>
        {(kids ?? []).map((k) => {
          const c = (Array.isArray(k.class) ? k.class[0] : k.class) as ClassRow | null;
          const b = bal?.find((x) => x.student_id === k.id);
          return b ? (
            <FeeCard key={k.id} studentName={`${k.first_name} ${k.last_name}`} level={c?.level} grade={c?.name} term={term?.name}
              total={Number(b.amount)} paid={Number(b.paid)} dueDate={b.due_date ? dateSw(b.due_date) : undefined}
              action={b.control_number ? <p style={{ margin: 0, fontSize: 14 }}>Control number: <b>{b.control_number}</b></p> : undefined} />
          ) : <p key={k.id} className="panel">{k.first_name}: bado hakuna bili ya muhula huu.</p>;
        })}
        {!kids?.length && <p className="empty">Hakuna mwanafunzi aliyeunganishwa na akaunti yako.</p>}
      </main>
    );
  }

  // ----- Staff view -----
  const [{ data: classes }, { data: students }, { data: att }] = await Promise.all([
    supabase.from('classes').select('id, name, level').order('sort_order'),
    supabase.from('students').select('id, class_id').eq('status', 'active'),
    supabase.from('attendance').select('class_id, status').eq('date', today),
  ]);
  const seesMoney = s.role === 'admin' || s.role === 'bursar';
  const { data: balances } = seesMoney && term
    ? await supabase.from('invoice_balances').select('student_id, amount, paid, balance, due_date').eq('term_id', term.id)
    : { data: null };

  const cls = (classes ?? []) as ClassRow[];
  const total = students?.length ?? 0;
  const byLevel = (lv: Level) => (students ?? []).filter((st) => cls.find((c) => c.id === st.class_id)?.level === lv).length;
  const marked = att ?? [];
  const present = marked.filter((a) => a.status !== 'absent').length;
  const billed = (balances ?? []).reduce((a, b) => a + Number(b.amount), 0);
  const collected = (balances ?? []).reduce((a, b) => a + Number(b.paid), 0);
  const debtors = (balances ?? []).filter((b) => Number(b.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance));
  const unmarked = cls.filter((c) => (students ?? []).some((st) => st.class_id === c.id) && !marked.some((m) => m.class_id === c.id));

  let names: Record<string, { name: string; cls: string; level: Level }> = {};
  if (debtors.length) {
    const { data } = await supabase.from('students').select('id, first_name, last_name, class:classes(name, level)')
      .in('id', debtors.slice(0, 5).map((d) => d.student_id));
    names = Object.fromEntries((data ?? []).map((d) => {
      const c = (Array.isArray(d.class) ? d.class[0] : d.class) as ClassRow | null;
      return [d.id, { name: `${d.first_name} ${d.last_name}`, cls: c?.name ?? '', level: c?.level ?? 'primary' }];
    }));
  }

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Habari, {s.fullName}</h1><p>{dayDateSw(new Date(today))}{term ? ` · ${term.name}` : ''}{s.role === 'teacher' ? ` · Madarasa yako: ${cls.map((c) => c.name).join(', ') || 'hujapangiwa bado'}` : ''}</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {seesMoney && <Link href="/students/new"><Button>+ Sajili mwanafunzi</Button></Link>}
          {s.role !== 'bursar' && <Link href="/attendance"><Button variant="outline">Mahudhurio ya leo</Button></Link>}
        </div>
      </div>

      <section className="stats">
        <StatCard label={s.role === 'teacher' ? 'Wanafunzi wako' : 'Wanafunzi'} value={total} hint={`Day Care ${byLevel('daycare')} · Awali ${byLevel('nursery')} · Msingi ${byLevel('primary')}`} />
        {seesMoney && <StatCard tone="orange" label="Ada iliyokusanywa" value={tshShort(collected)} hint={billed ? `${Math.round((collected / billed) * 100)}% ya ${tshShort(billed)}` : 'Bado hakuna bili'} />}
        {seesMoney && <StatCard tone="sun" label="Wenye madeni" value={debtors.length} hint={`${tshShort(billed - collected)} bado`} />}
        <StatCard tone="light" label="Mahudhurio leo" value={marked.length ? `${Math.round((present / marked.length) * 100)}%` : '—'} hint={`${present} kati ya ${marked.length} waliowekwa`} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        {seesMoney && (
          <section className="panel">
            <h2>Madeni makubwa</h2>
            {debtors.length ? (
              <table className="table">
                <thead><tr><th>Mwanafunzi</th><th>Darasa</th><th className="num">Salio</th><th>Hali</th></tr></thead>
                <tbody>
                  {debtors.slice(0, 5).map((d) => {
                    const n = names[d.student_id];
                    const late = d.due_date && d.due_date < today;
                    return (
                      <tr key={d.student_id}>
                        <td><b>{n?.name}</b></td>
                        <td>{n && <LevelTag level={n.level}>{n.cls}</LevelTag>}</td>
                        <td className="num owe">{tsh(d.balance)}</td>
                        <td><StatusBadge status={late ? 'overdue' : 'pending'} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p className="empty">Hakuna madeni. Hongera!</p>}
          </section>
        )}
        <section className="panel">
          <h2>Kinahitaji hatua leo</h2>
          {unmarked.length ? (
            <p style={{ margin: 0 }}><b style={{ color: 'var(--danger)' }}>Madarasa {unmarked.length}</b> hayajajazwa mahudhurio: {unmarked.map((c) => c.name).join(', ')}</p>
          ) : <p style={{ margin: 0 }}>Mahudhurio ya madarasa yote yamejazwa.</p>}
          {term && <p style={{ margin: '12px 0 0' }}><b>{term.name}</b> inaisha {dateSw(term.ends_on)}.</p>}
        </section>
      </div>
    </main>
  );
}
