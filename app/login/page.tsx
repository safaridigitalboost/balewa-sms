import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button, TextField } from '@/components/ui';

async function signIn(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (error) redirect('/login?error=login');
  redirect('/dashboard');
}

const MESSAGES: Record<string, string> = {
  login: 'Barua pepe au nenosiri si sahihi. Jaribu tena.',
  'no-profile': 'Akaunti yako haijaunganishwa na shule au imezimwa. Wasiliana na ofisi ya shule.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-4)' }}>
      <form action={signIn} className="panel" style={{ width: '100%', maxWidth: 400, display: 'grid', gap: 'var(--space-4)', paddingTop: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balewa-crest.png" alt="Balewa crest" width={88} height={88} style={{ borderRadius: '50%' }} />
          <h1 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 800, color: 'var(--balewa-blue)' }}>Balewa Schools</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-muted)' }}>Ingia kwenye mfumo wa shule</p>
        </div>
        {error && <p className="notice notice-err" role="alert">{MESSAGES[error] ?? MESSAGES.login}</p>}
        <TextField label="Barua pepe" name="email" type="email" required autoComplete="email" />
        <TextField label="Nenosiri" name="password" type="password" required autoComplete="current-password" />
        <Button type="submit" block size="lg">Ingia</Button>
      </form>
    </main>
  );
}
