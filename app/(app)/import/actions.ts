'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { currentTerm, requireSession } from '@/lib/session';
import { checkPayment, checkStudent } from '@/lib/import-rules';

export type ImportResult = { ok: boolean; added: number; skipped: string[]; message?: string };

const MAX_ROWS = 1000;

export async function importStudents(raw: Record<string, string>[]): Promise<ImportResult> {
  const s = await requireSession(['admin', 'bursar']);
  const supabase = await createClient();
  if (raw.length > MAX_ROWS) return { ok: false, added: 0, skipped: [], message: `Safu nyingi mno. Gawanya file (kiwango ni ${MAX_ROWS}).` };

  const { data: classes } = await supabase.from('classes').select('id, name, level');
  const cls = classes ?? [];
  const skipped: string[] = [];
  // Re-validate on the server: never trust the browser
  const rows = raw.flatMap((r, i) => {
    const res = checkStudent(r, cls.map((c) => c.name));
    if (!res.row) { skipped.push(`Safu ${i + 2}: ${res.errors.join(', ')}`); return []; }
    return [res.row];
  });

  // Skip students that already exist (same name in the same class)
  const { data: existing } = await supabase.from('students').select('first_name, last_name, class_id').eq('status', 'active');
  const key = (f: string, l: string, c: string) => `${f}|${l}|${c}`.toLowerCase();
  const have = new Set((existing ?? []).map((e) => key(e.first_name, e.last_name, e.class_id ?? '')));
  const fresh = rows.filter((r) => {
    const c = cls.find((x) => x.name === r.class)!;
    const dup = have.has(key(r.first_name, r.last_name, c.id));
    if (dup) skipped.push(`${r.first_name} ${r.last_name} (${r.class}): tayari yupo`);
    have.add(key(r.first_name, r.last_name, c.id));
    return !dup;
  });
  if (!fresh.length) return { ok: true, added: 0, skipped };

  // Registration numbers: one RPC for the next number, then count up
  const year = new Date().getFullYear();
  const { data: first, error: regErr } = await supabase.rpc('next_reg_no', { p_school: s.school.id, p_year: year });
  if (regErr || !first) return { ok: false, added: 0, skipped, message: 'Imeshindikana kutengeneza namba za usajili.' };
  const m = String(first).match(/^(.*-)(\d+)$/)!;
  const regNo = (i: number) => m[1] + String(Number(m[2]) + i).padStart(4, '0');

  // Guardians: reuse by phone, create the rest
  const phones = [...new Set(fresh.map((r) => r.guardian_phone))];
  const { data: gExisting } = await supabase.from('guardians').select('id, phone').in('phone', phones);
  const gByPhone = new Map((gExisting ?? []).map((g) => [g.phone, g.id]));
  const newG = phones.filter((p) => !gByPhone.has(p)).map((p) => {
    const r = fresh.find((x) => x.guardian_phone === p)!;
    return { school_id: s.school.id, full_name: r.guardian_name, phone: p, relationship: r.relationship };
  });
  if (newG.length) {
    const { data: gNew, error } = await supabase.from('guardians').insert(newG).select('id, phone');
    if (error) return { ok: false, added: 0, skipped, message: 'Imeshindikana kuhifadhi wazazi.' };
    gNew?.forEach((g) => gByPhone.set(g.phone, g.id));
  }

  const { data: inserted, error: stErr } = await supabase.from('students').insert(fresh.map((r, i) => ({
    school_id: s.school.id, reg_no: regNo(i), first_name: r.first_name, middle_name: r.middle_name, last_name: r.last_name,
    gender: r.gender, date_of_birth: r.date_of_birth, previous_school: r.previous_school,
    class_id: cls.find((c) => c.name === r.class)!.id,
  }))).select('id, reg_no');
  if (stErr || !inserted) return { ok: false, added: 0, skipped, message: 'Imeshindikana kuhifadhi wanafunzi. Hakuna kilichoingizwa.' };

  const byReg = new Map(inserted.map((x) => [x.reg_no, x.id]));
  await supabase.from('student_guardians').insert(fresh.map((r, i) => ({ student_id: byReg.get(regNo(i))!, guardian_id: gByPhone.get(r.guardian_phone)! })));

  // Bill the current term
  const term = await currentTerm(s.school.id);
  if (term) {
    const { data: items } = await supabase.from('fee_items').select('level, amount').eq('term_id', term.id);
    const feeFor = (lv: string) => (items ?? []).filter((x) => x.level === lv).reduce((a, x) => a + Number(x.amount), 0);
    const inv = fresh.map((r, i) => ({
      school_id: s.school.id, student_id: byReg.get(regNo(i))!, term_id: term.id, due_date: term.ends_on,
      amount: feeFor(cls.find((c) => c.name === r.class)!.level),
    })).filter((x) => x.amount > 0);
    if (inv.length) await supabase.from('invoices').insert(inv);
  }
  revalidatePath('/students'); revalidatePath('/dashboard'); revalidatePath('/fees');
  return { ok: true, added: inserted.length, skipped };
}

export async function importPayments(raw: Record<string, string>[]): Promise<ImportResult> {
  const s = await requireSession(['admin', 'bursar']);
  const supabase = await createClient();
  if (raw.length > MAX_ROWS) return { ok: false, added: 0, skipped: [], message: `Safu nyingi mno. Gawanya file (kiwango ni ${MAX_ROWS}).` };
  const term = await currentTerm(s.school.id);
  if (!term) return { ok: false, added: 0, skipped: [], message: 'Hakuna muhula unaoendelea.' };

  const skipped: string[] = [];
  const rows = raw.flatMap((r, i) => {
    const res = checkPayment(r);
    if (!res.row) { skipped.push(`Safu ${i + 2}: ${res.errors.join(', ')}`); return []; }
    return [res.row];
  });

  const regs = [...new Set(rows.map((r) => r.reg_no))];
  const { data: st } = await supabase.from('students').select('id, reg_no').in('reg_no', regs);
  const { data: inv } = await supabase.from('invoice_balances').select('invoice_id, student_id, balance').eq('term_id', term.id).in('student_id', (st ?? []).map((x) => x.id));
  const invByReg = new Map((st ?? []).map((x) => [x.reg_no, inv?.find((i) => i.student_id === x.id)]));
  const left = new Map((inv ?? []).map((i) => [i.invoice_id, Number(i.balance)]));

  const refs = rows.map((r) => r.reference).filter(Boolean) as string[];
  const { data: seen } = refs.length ? await supabase.from('payments').select('reference').in('reference', refs) : { data: [] };
  const used = new Set((seen ?? []).map((p) => p.reference));

  const toInsert = rows.flatMap((r) => {
    const invoiceId = invByReg.get(r.reg_no)?.invoice_id;
    if (!invoiceId) { skipped.push(`${r.reg_no}: hana bili ya ${term.name}`); return []; }
    if (r.reference && used.has(r.reference)) { skipped.push(`${r.reg_no}: muamala ${r.reference} tayari umeingizwa`); return []; }
    const remaining = left.get(invoiceId) ?? 0;
    if (remaining <= 0) { skipped.push(`${r.reg_no}: ameshalipa ada yote ya ${term.name}`); return []; }
    if (r.amount > remaining) skipped.push(`${r.reg_no}: amelipa TSh ${(r.amount - remaining).toLocaleString('en-US')} zaidi ya salio (malipo yameingizwa, angalia)`);
    left.set(invoiceId, remaining - r.amount);
    if (r.reference) used.add(r.reference);
    return [{ school_id: s.school.id, invoice_id: invoiceId, amount: r.amount, method: r.method, reference: r.reference,
      paid_at: r.paid_on ? `${r.paid_on}T09:00:00+03:00` : new Date().toISOString(), recorded_by: s.userId }];
  });
  if (!toInsert.length) return { ok: true, added: 0, skipped };
  const { error } = await supabase.from('payments').insert(toInsert);
  if (error) return { ok: false, added: 0, skipped, message: 'Imeshindikana kuhifadhi malipo. Hakuna kilichoingizwa.' };
  revalidatePath('/fees'); revalidatePath('/dashboard');
  return { ok: true, added: toInsert.length, skipped };
}
