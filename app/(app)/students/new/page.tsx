import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { EnrolForm } from './enrol-form';

export default async function NewStudentPage() {
  await requireSession(['admin', 'bursar']);
  const supabase = await createClient();
  const { data: classes } = await supabase.from('classes').select('id, name, level').order('sort_order');
  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <div className="page-head"><div><h1>Sajili mwanafunzi mpya</h1><p>Sehemu zenye * ni lazima</p></div></div>
      <EnrolForm classes={classes ?? []} />
    </main>
  );
}
