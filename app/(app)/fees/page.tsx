import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentTerm, requireSession } from '@/lib/session';
import { Button, LevelTag, SelectField, StatCard, StatusBadge, type Level } from '@/components/ui';
import { dateSw, todayTZ, tsh, tshShort } from '@/lib/format';

async function recordPayment(formData: FormData) {
  'use server';
  const s = await requireSession(['admin', 'bursar']);
  const supabase = await createClient();
  const amount = Math.round(Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, '')));
  const invoiceId = String(formData.get('invoice_id') ?? '');
  const method = String(formData.get('method') ?? 'cash');
  if (!invoiceId || !(amount > 0)) redirect('/fees?error=amount');
  const { error } = await supabase.from('payments').insert({
    school_id: s.school.id, invoice_id: invoiceId, amount, method,
    reference: String(formData.get('reference') ?? '').trim() || null, recorded_by: s.userId,
  });
  if (error) redirect('/fees?error=save');
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  redirect('/fees?paid=' + amount);
}

const ERR: Record<string, string> = { amount: 'Weka kiasi sahihi cha malipo.', save: 'Imeshindikana kuhifadhi malipo. Huenda namba ya muamala imeshatumika.' };

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ show?: string; paid?: string; error?: string }> }) {
  const s = await requireSession(['admin', 'bursar']);
  const { show = 'owing', paid, error } = await searchParams;
  const supabase = await createClient();
  const term = await currentTerm(s.school.id);
  if (!term) return <main className="page"><p className="panel empty">Hakuna muhula unaoendelea. Weka muhula kwenye mipangilio.</p></main>;

  const { data: rows } = await supabase.from('invoice_balances')
    .select('invoice_id, student_id, amount, paid, balance, due_date, control_number').eq('term_id', term.id);
  const { data: students } = await supabase.from('students')
    .select('id, reg_no, first_name, last_name, class:classes(name, level)').in('id', (rows ?? []).map((r) => r.student_id));
  const byId = new Map((students ?? []).map((st) => [st.id, st]));
  const today = todayTZ();
  const list = (rows ?? []).filter((r) => (show === 'all' ? true : Number(r.balance) > 0))
    .sort((a, b) => Number(b.balance) - Number(a.balance));
  const billed = (rows ?? []).reduce((a, r) => a + Number(r.amount), 0);
  const got = (rows ?? []).reduce((a, r) => a + Number(r.paid), 0);

  return (
    <main className="page">
      <div className="page-head"><div><h1>Ada · {term.name}</h1><p>Mwisho wa kulipa: {dateSw(term.ends_on)}</p></div></div>
      {paid && <p className="notice notice-ok" role="status">Malipo ya {tsh(paid)} yamehifadhiwa.</p>}
      {error && <p className="notice notice-err" role="alert">{ERR[error] ?? ERR.save}</p>}
      <section className="stats">
        <StatCard label="Bili za muhula" value={tshShort(billed)} />
        <StatCard tone="orange" label="Imekusanywa" value={tshShort(got)} hint={billed ? `${Math.round((got / billed) * 100)}%` : undefined} />
        <StatCard tone="sun" label="Bado" value={tshShort(billed - got)} hint={`${(rows ?? []).filter((r) => Number(r.balance) > 0).length} wanafunzi`} />
      </section>
      <form className="filters">
        <SelectField label="Onyesha" name="show" defaultValue={show}
          options={[{ value: 'owing', label: 'Wenye madeni tu' }, { value: 'all', label: 'Wote' }]} />
        <Button type="submit" variant="outline">Chuja</Button>
      </form>
      <section className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Mwanafunzi</th><th>Darasa</th><th className="num">Bili</th><th className="num">Amelipa</th><th className="num">Salio</th><th>Hali</th><th>Rekodi malipo</th></tr></thead>
          <tbody>
            {list.map((r) => {
              const st = byId.get(r.student_id);
              const c = st ? ((Array.isArray(st.class) ? st.class[0] : st.class) as { name: string; level: Level } | null) : null;
              const bal = Number(r.balance);
              const status = bal <= 0 ? 'paid' : r.due_date && r.due_date < today ? 'overdue' : Number(r.paid) > 0 ? 'partial' : 'pending';
              return (
                <tr key={r.invoice_id}>
                  <td><b>{st ? `${st.first_name} ${st.last_name}` : '—'}</b><br /><small style={{ color: 'var(--ink-muted)' }}>{st?.reg_no}</small></td>
                  <td>{c && <LevelTag level={c.level}>{c.name}</LevelTag>}</td>
                  <td className="num">{tsh(r.amount)}</td>
                  <td className="num">{tsh(r.paid)}</td>
                  <td className={`num${bal > 0 ? ' owe' : ''}`}>{tsh(bal)}</td>
                  <td><StatusBadge status={status} /></td>
                  <td>
                    {bal > 0 && (
                      <form action={recordPayment} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="hidden" name="invoice_id" value={r.invoice_id} />
                        <input name="amount" className="bw-input" inputMode="numeric" placeholder="Kiasi" aria-label="Kiasi" style={{ width: 110, minHeight: 36 }} />
                        <select name="method" className="bw-input" aria-label="Njia" style={{ minHeight: 36, width: 100 }}>
                          <option value="mpesa">M-Pesa</option><option value="mixx">Mixx</option><option value="airtel">Airtel</option>
                          <option value="bank">Benki</option><option value="cash">Taslimu</option>
                        </select>
                        <input name="reference" className="bw-input" placeholder="Namba ya muamala" aria-label="Namba ya muamala" style={{ width: 150, minHeight: 36 }} />
                        <Button type="submit" size="sm" variant="secondary">Hifadhi</Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="empty">{show === 'all' ? 'Hakuna bili za muhula huu.' : 'Hakuna madeni. Hongera!'}</p>}
      </section>
    </main>
  );
}
