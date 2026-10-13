// Balewa UI components — TypeScript port of the Balewa Schools design system bundle.
// Styles live in app/globals.css (bw-* classes).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { tsh } from '@/lib/format';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export type Lang = 'sw' | 'en';
export type Status = 'paid' | 'partial' | 'pending' | 'overdue' | 'present' | 'late' | 'absent';
export type Level = 'daycare' | 'nursery' | 'primary';

export const STATUS: Record<Status, { tone: 'leaf' | 'sun' | 'danger'; sw: string; en: string }> = {
  paid: { tone: 'leaf', sw: 'Imelipwa', en: 'Paid' },
  partial: { tone: 'sun', sw: 'Sehemu', en: 'Part paid' },
  pending: { tone: 'sun', sw: 'Inasubiri', en: 'Pending' },
  overdue: { tone: 'danger', sw: 'Imechelewa', en: 'Overdue' },
  present: { tone: 'leaf', sw: 'Yupo', en: 'Present' },
  late: { tone: 'sun', sw: 'Amechelewa', en: 'Late' },
  absent: { tone: 'danger', sw: 'Hayupo', en: 'Absent' },
};
const LEVELS: Record<Level, { sw: string; en: string }> = {
  daycare: { sw: 'Day Care', en: 'Day Care' },
  nursery: { sw: 'Awali', en: 'Nursery' },
  primary: { sw: 'Msingi', en: 'Primary' },
};

export function Button({ variant = 'primary', size = 'md', block, className, children, type = 'button', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'lg'; block?: boolean }) {
  return (
    <button type={type} {...rest} className={cx('bw-btn', `bw-btn-${variant}`, `bw-btn-${size}`, block && 'bw-btn-block', className)}>
      {children}
    </button>
  );
}

export function StatusBadge({ status, lang = 'sw', children }: { status: Status; lang?: Lang; children?: ReactNode }) {
  const s = STATUS[status];
  return (
    <span className={cx('bw-badge', `bw-badge-${s.tone}`)}>
      <span className="bw-badge-dot" aria-hidden />
      {children ?? s[lang]}
    </span>
  );
}

export function LevelTag({ level, lang = 'en', children }: { level: Level; lang?: Lang; children?: ReactNode }) {
  return <span className={cx('bw-level', `bw-level-${level}`)}>{children ?? LEVELS[level][lang]}</span>;
}

export function TextField({ label, hint, error, required, id, ...rest }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const fid = id ?? 'f-' + (rest.name ?? label).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className={cx('bw-field', error && 'bw-field-error')}>
      <label htmlFor={fid} className="bw-field-label">
        {label}{required && <span className="bw-req" aria-hidden> *</span>}
      </label>
      <input id={fid} className="bw-input" required={required} aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? fid + '-msg' : undefined} {...rest} />
      {(error || hint) && <p id={fid + '-msg'} className={error ? 'bw-field-err' : 'bw-field-hint'}>{error ?? hint}</p>}
    </div>
  );
}

export function SelectField({ label, options, id, ...rest }:
  SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const fid = id ?? 's-' + (rest.name ?? label).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="bw-field">
      <label htmlFor={fid} className="bw-field-label">{label}</label>
      <select id={fid} className="bw-input" {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'blue' }:
  { label: string; value: ReactNode; hint?: ReactNode; tone?: 'blue' | 'orange' | 'sun' | 'light' }) {
  return (
    <div className={cx('bw-stat', `bw-stat-${tone}`)}>
      <p className="bw-stat-label">{label}</p>
      <p className="bw-stat-value">{value}</p>
      {hint && <p className="bw-stat-hint">{hint}</p>}
    </div>
  );
}

export function FeeCard({ studentName, level, grade, term, total, paid, dueDate, overdue, lang = 'sw', action }:
  { studentName: string; level?: Level; grade?: string; term?: string; total: number; paid: number; dueDate?: string;
    overdue?: boolean; lang?: Lang; action?: ReactNode }) {
  const p = Math.min(paid, total), bal = total - p, pct = total ? Math.round((p / total) * 100) : 0;
  const status: Status = bal <= 0 ? 'paid' : overdue ? 'overdue' : p > 0 ? 'partial' : 'pending';
  const t = lang === 'sw' ? { paid: 'Amelipa', bal: 'Salio', due: 'Mwisho' } : { paid: 'Paid', bal: 'Balance', due: 'Due' };
  return (
    <article className="bw-fee">
      <header className="bw-fee-head">
        <div>
          <p className="bw-fee-name">{studentName}</p>
          <p className="bw-fee-meta">{level && <LevelTag level={level} />}{grade}{term && ` · ${term}`}</p>
        </div>
        <StatusBadge status={status} lang={lang} />
      </header>
      <div className="bw-fee-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: pct + '%' }} />
      </div>
      <dl className="bw-fee-nums">
        <div><dt>{t.paid}</dt><dd>{tsh(p)}</dd></div>
        <div><dt>{t.bal}</dt><dd className={bal > 0 ? 'bw-owe' : undefined}>{tsh(bal)}</dd></div>
        {dueDate && <div><dt>{t.due}</dt><dd>{dueDate}</dd></div>}
      </dl>
      {action && <div className="bw-fee-foot">{action}</div>}
    </article>
  );
}
