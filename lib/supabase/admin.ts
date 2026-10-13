import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client: bypasses Row Level Security. Server-only.
 * Use ONLY after the caller has been checked as an admin (requireSession(['admin'])),
 * and always scope queries to that admin's school_id.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Readable temporary password, e.g. "Balewa-7K4P-92" */
export function tempPassword() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const s = Array.from(bytes, (b) => abc[b % abc.length]).join('');
  return `Balewa-${s.slice(0, 4)}-${s.slice(4)}`;
}
