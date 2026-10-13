'use client';
import { useActionState } from 'react';
import { Button, SelectField, TextField } from '@/components/ui';
import { enrolStudent, type EnrolState } from './actions';

export function EnrolForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<EnrolState, FormData>(enrolStudent, {});
  const e = state.errors ?? {};
  return (
    <form action={action} style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {state.message && <p className="notice notice-err" role="alert">{state.message}</p>}
      <section className="panel">
        <h2>1. Taarifa za mwanafunzi</h2>
        <div className="form-grid">
          <TextField label="Jina la kwanza" name="first_name" required error={e.first_name} />
          <TextField label="Jina la kati" name="middle_name" />
          <TextField label="Jina la ukoo" name="last_name" required error={e.last_name} />
          <TextField label="Tarehe ya kuzaliwa" name="date_of_birth" type="date" />
          <SelectField label="Jinsia" name="gender" options={[{ value: 'female', label: 'Msichana' }, { value: 'male', label: 'Mvulana' }]} />
          <TextField label="Shule aliyotoka" name="previous_school" hint="Kwa wanaohamia tu" />
        </div>
      </section>
      <section className="panel">
        <h2>2. Darasa</h2>
        <div className="form-grid">
          <SelectField label="Darasa *" name="class_id" required defaultValue=""
            options={[{ value: '', label: 'Chagua darasa' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
          {e.class_id && <p className="bw-field-err">{e.class_id}</p>}
        </div>
      </section>
      <section className="panel">
        <h2>3. Mzazi au mlezi</h2>
        <div className="form-grid">
          <TextField label="Jina kamili" name="guardian_name" required error={e.guardian_name} />
          <SelectField label="Uhusiano" name="relationship" options={['Mama', 'Baba', 'Mlezi'].map((v) => ({ value: v, label: v }))} />
          <TextField label="Simu" name="guardian_phone" type="tel" required placeholder="0712 964 348" error={e.guardian_phone} hint="SMS za ada na matokeo zitatumwa hapa" />
          <TextField label="Mahali anapoishi" name="address" placeholder="mf. Kibamba, Mng’ongoni" />
        </div>
      </section>
      <div><Button type="submit" variant="secondary" size="lg" disabled={pending}>{pending ? 'Inahifadhi…' : 'Hifadhi usajili'}</Button></div>
    </form>
  );
}
