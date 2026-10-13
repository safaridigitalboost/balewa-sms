import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { Importer } from './importer';

export default async function ImportPage() {
  await requireSession(['admin', 'bursar']);
  const supabase = await createClient();
  const { data: classes } = await supabase.from('classes').select('name').order('sort_order');
  return (
    <main className="page" style={{ maxWidth: 1000 }}>
      <div className="page-head">
        <div><h1>Ingiza data (Import)</h1><p>Pakia file la CSV kutoka Excel au Google Sheets. Utaona hakiki kabla ya kuhifadhi.</p></div>
      </div>
      <Importer classNames={(classes ?? []).map((c) => c.name)} />
    </main>
  );
}
