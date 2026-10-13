'use client';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { parseCsv, toCsv } from '@/lib/csv';
import { checkPayment, checkStudent, TEMPLATES, type ImportKind } from '@/lib/import-rules';
import { importPayments, importStudents, type ImportResult } from './actions';

const LABEL: Record<ImportKind, string> = { students: 'Wanafunzi na wazazi', payments: 'Malipo ya ada' };

export function Importer({ classNames }: { classNames: string[] }) {
  const [kind, setKind] = useState<ImportKind>('students');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const t = TEMPLATES[kind];

  const checked = useMemo(() => rows.map((r) => (kind === 'students' ? checkStudent(r, classNames) : checkPayment(r))), [rows, kind, classNames]);
  const good = checked.filter((c) => c.row).length;
  const missingCols = rows.length ? t.headers.filter((h) => !(h in rows[0]) && !['middle_name', 'previous_school', 'relationship', 'reference', 'paid_on', 'date_of_birth', 'gender'].includes(h)) : [];

  function reset(k: ImportKind) { setKind(k); setRows([]); setFileName(''); setResult(null); }
  async function onFile(f: File | undefined) {
    if (!f) return;
    setResult(null); setFileName(f.name);
    setRows(parseCsv(await f.text()));
  }
  function downloadTemplate() {
    const blob = new Blob([toCsv(t.headers, t.example)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `balewa-${kind}-template.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <div className="filters" role="tablist">
        {(Object.keys(LABEL) as ImportKind[]).map((k) => (
          <Button key={k} role="tab" aria-selected={k === kind} variant={k === kind ? 'primary' : 'outline'} onClick={() => reset(k)}>{LABEL[k]}</Button>
        ))}
      </div>

      <section className="panel">
        <h2>1. Andaa file</h2>
        <p style={{ marginTop: 0 }}>{t.help}</p>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Safu zinazohitajika: <code>{t.headers.join(', ')}</code></p>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>Pakua template (CSV)</Button>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 0 }}>Excel: File → Save As → <b>CSV UTF-8</b>.</p>
      </section>

      <section className="panel">
        <h2>2. Pakia file</h2>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Chagua file la CSV" />
        {fileName && <p style={{ marginBottom: 0 }}><b>{fileName}</b>: safu {rows.length} · <span style={{ color: 'var(--leaf)', fontWeight: 700 }}>{good} sahihi</span> · <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{rows.length - good} zenye makosa</span></p>}
        {missingCols.length > 0 && <p className="notice notice-err">Safu hizi hazipo kwenye file: {missingCols.join(', ')}. Tumia template.</p>}
      </section>

      {rows.length > 0 && (
        <section className="panel" style={{ overflowX: 'auto' }}>
          <h2>3. Hakiki</h2>
          <table className="table">
            <thead><tr><th>#</th>{t.headers.slice(0, 6).map((h) => <th key={h}>{h}</th>)}<th>Hali</th></tr></thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={i}>
                  <td>{i + 2}</td>
                  {t.headers.slice(0, 6).map((h) => <td key={h}>{r[h]}</td>)}
                  <td>{checked[i].row ? <span style={{ color: 'var(--leaf)', fontWeight: 700 }}>Sawa</span>
                    : <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{checked[i].errors.join('; ')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && <p className="empty">Inaonyesha safu 200 za kwanza kati ya {rows.length}.</p>}
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="lg" disabled={!good || pending}
              onClick={() => start(async () => setResult(await (kind === 'students' ? importStudents(rows) : importPayments(rows))))}>
              {pending ? 'Inaingiza…' : `Ingiza safu ${good} sahihi`}
            </Button>
            {rows.length - good > 0 && <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Safu zenye makosa zitarukwa. Zirekebishe kwenye Excel na upakie tena.</span>}
          </div>
        </section>
      )}

      {result && (
        <section className={`notice ${result.ok ? 'notice-ok' : 'notice-err'}`} role="status">
          {result.message ?? `Imekamilika: ${result.added} ${kind === 'students' ? 'wanafunzi wameingizwa (pamoja na bili za muhula)' : 'malipo yameingizwa'}.`}
          {result.skipped.length > 0 && (
            <details style={{ marginTop: 8, fontWeight: 500 }}>
              <summary>Zilizorukwa ({result.skipped.length})</summary>
              <ul>{result.skipped.slice(0, 100).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
