// Row validation shared by the import preview (browser) and the import action (server).
import { normalisePhone } from '@/lib/format';

export type ImportKind = 'students' | 'payments';

export const TEMPLATES: Record<ImportKind, { headers: string[]; example: string[][]; help: string }> = {
  students: {
    headers: ['first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth', 'class', 'guardian_name', 'guardian_phone', 'relationship', 'previous_school'],
    example: [
      ['Neema', 'Juma', 'Mushi', 'F', '2018-03-14', 'Std 2', 'Amina Mushi', '0712 345 678', 'Mama', ''],
      ['Baraka', '', 'Lyimo', 'M', '2021-07-02', 'Baby Class', 'John Lyimo', '0754 111 222', 'Baba', 'Little Stars'],
    ],
    help: 'Safu moja kwa kila mwanafunzi. Darasa liandikwe kama lilivyo kwenye mfumo (mf. "Baby Class", "Std 4"). Jinsia: F/M au Msichana/Mvulana. Tarehe: YYYY-MM-DD au DD/MM/YYYY. Watoto wenye namba moja ya simu ya mzazi wataunganishwa na mzazi mmoja.',
  },
  payments: {
    headers: ['reg_no', 'amount', 'method', 'reference', 'paid_on'],
    example: [
      ['BAL-2026-0001', '150000', 'mpesa', 'QJK7H2LM9P', '2026-10-02'],
      ['BAL-2026-0002', '450000', 'bank', 'CRDB-88231', '03/10/2026'],
    ],
    help: 'Malipo ya muhula huu. Njia: mpesa, mixx, airtel, bank au cash. Namba ya muamala (reference) ikijirudia, safu hiyo inarukwa ili malipo yasiingie mara mbili.',
  },
};

export type StudentRow = {
  first_name: string; middle_name: string | null; last_name: string; gender: 'female' | 'male' | null;
  date_of_birth: string | null; class: string; guardian_name: string; guardian_phone: string; relationship: string; previous_school: string | null;
};
export type PaymentRow = { reg_no: string; amount: number; method: 'mpesa' | 'mixx' | 'airtel' | 'bank' | 'cash'; reference: string | null; paid_on: string | null };

export function parseDate(v: string): string | null | 'bad' {
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return 'bad';
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || y < 1990 || y > 2100) return 'bad';
  return dt.toISOString().slice(0, 10);
}

const GENDER: Record<string, 'female' | 'male'> = { f: 'female', female: 'female', msichana: 'female', ke: 'female', m: 'male', male: 'male', mvulana: 'male', me: 'male' };
const METHOD: Record<string, PaymentRow['method']> = { mpesa: 'mpesa', 'm-pesa': 'mpesa', mixx: 'mixx', tigopesa: 'mixx', 'tigo pesa': 'mixx', yas: 'mixx', airtel: 'airtel', 'airtel money': 'airtel', bank: 'bank', benki: 'bank', cash: 'cash', taslimu: 'cash' };

export function checkStudent(r: Record<string, string>, classNames: string[]): { row?: StudentRow; errors: string[] } {
  const e: string[] = [];
  const cls = classNames.find((c) => c.toLowerCase() === (r.class ?? '').trim().toLowerCase());
  if (!r.first_name) e.push('jina la kwanza halipo');
  if (!r.last_name) e.push('jina la ukoo halipo');
  if (!cls) e.push(`darasa "${r.class ?? ''}" halijulikani`);
  const g = r.gender ? GENDER[r.gender.trim().toLowerCase()] : null;
  if (r.gender && !g) e.push('jinsia si sahihi');
  const dob = parseDate(r.date_of_birth ?? '');
  if (dob === 'bad') e.push('tarehe ya kuzaliwa si sahihi');
  if (!r.guardian_name) e.push('jina la mzazi halipo');
  const phone = normalisePhone(r.guardian_phone ?? '');
  if (!phone) e.push('simu ya mzazi si sahihi');
  if (e.length) return { errors: e };
  return {
    errors: [],
    row: {
      first_name: r.first_name, middle_name: r.middle_name || null, last_name: r.last_name, gender: g ?? null,
      date_of_birth: dob as string | null, class: cls!, guardian_name: r.guardian_name, guardian_phone: phone!,
      relationship: r.relationship || 'Mama', previous_school: r.previous_school || null,
    },
  };
}

export function checkPayment(r: Record<string, string>): { row?: PaymentRow; errors: string[] } {
  const e: string[] = [];
  const amount = Math.round(Number((r.amount ?? '').replace(/[^\d.]/g, '')));
  if (!r.reg_no) e.push('namba ya usajili haipo');
  if (!(amount > 0)) e.push('kiasi si sahihi');
  const method = METHOD[(r.method ?? '').trim().toLowerCase()];
  if (!method) e.push('njia ya malipo haijulikani');
  const paid = parseDate(r.paid_on ?? '');
  if (paid === 'bad') e.push('tarehe si sahihi');
  if (e.length) return { errors: e };
  return { errors: [], row: { reg_no: r.reg_no.trim().toUpperCase(), amount, method: method!, reference: r.reference || null, paid_on: paid as string | null } };
}
