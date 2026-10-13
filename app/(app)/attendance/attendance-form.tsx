'use client';
import { useState, useTransition } from 'react';
import { Button, STATUS } from '@/components/ui';
import { saveAttendance } from './actions';

type S = 'present' | 'late' | 'absent';
const OPTS: S[] = ['present', 'late', 'absent'];

export function AttendanceForm({ classId, date, students, alreadySaved }:
  { classId: string; date: string; students: { id: string; name: string; status: S }[]; alreadySaved: boolean }) {
  const [marks, setMarks] = useState<S[]>(students.map((s) => s.status));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    alreadySaved ? { ok: true, text: 'Mahudhurio ya leo yameshahifadhiwa. Unaweza kubadilisha na kuhifadhi tena.' } : null);
  const [pending, start] = useTransition();
  const count = (v: S) => marks.filter((m) => m === v).length;

  if (!students.length) return <p className="empty panel">Hakuna wanafunzi kwenye darasa hili.</p>;

  return (
    <>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="panel" style={{ textAlign: 'center', padding: 12 }}><b style={{ fontSize: 24, color: 'var(--leaf)' }}>{count('present')}</b><br /><small>Wapo</small></div>
        <div className="panel" style={{ textAlign: 'center', padding: 12 }}><b style={{ fontSize: 24, color: 'var(--orange-deep)' }}>{count('late')}</b><br /><small>Wamechelewa</small></div>
        <div className="panel" style={{ textAlign: 'center', padding: 12 }}><b style={{ fontSize: 24, color: 'var(--danger)' }}>{count('absent')}</b><br /><small>Hawapo</small></div>
      </div>
      {msg && <p className={`notice ${msg.ok ? 'notice-ok' : 'notice-err'}`} role="status">{msg.text}</p>}
      {!msg && <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13 }}>Wote wameanza kama “Yupo”. Gusa wale tu ambao hawapo au wamechelewa.</p>}
      <div className="bw-att" style={{ maxWidth: 'none' }}>
        <ul className="bw-att-list">
          {students.map((s, i) => (
            <li key={s.id} className="bw-att-row">
              <span className="bw-att-name">{s.name}</span>
              <div className="bw-seg" role="radiogroup" aria-label={s.name}>
                {OPTS.map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={marks[i] === o}
                    className={`bw-seg-btn${marks[i] === o ? ` bw-seg-on-${STATUS[o].tone}` : ''}`}
                    onClick={() => { const n = marks.slice(); n[i] = o; setMarks(n); setMsg(null); }}>
                    {STATUS[o].sw}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Button block size="lg" disabled={pending} onClick={() => start(async () => {
        const res = await saveAttendance(classId, date, students.map((s, i) => ({ studentId: s.id, status: marks[i] })));
        setMsg(res.ok
          ? { ok: true, text: `Imehifadhiwa. ${res.queued ? `SMS ${res.queued} zimeandaliwa kwa wazazi wa wasiohudhuria.` : 'Hakuna SMS ya kutuma.'}` }
          : { ok: false, text: res.message });
      })}>
        {pending ? 'Inahifadhi…' : `Hifadhi mahudhurio (${students.length})`}
      </Button>
    </>
  );
}
