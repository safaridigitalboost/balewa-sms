'use client';
import { useActionState, useState, useTransition } from 'react';
import { Button, LevelTag, SelectField, TextField, type Level } from '@/components/ui';
import type { Role } from '@/lib/session';
import { createUser, resetPassword, setActive, setTeacherClasses, type UserResult } from './actions';

export type UserRow = { id: string; fullName: string; role: Role; phone: string | null; email: string | null; active: boolean; classIds: string[]; isMe: boolean };
type Cls = { id: string; name: string; level: Level };

const ROLE_SW: Record<Role, string> = { admin: 'Mkuu wa shule', bursar: 'Mhasibu', teacher: 'Mwalimu', parent: 'Mzazi' };
const ORDER: Role[] = ['admin', 'bursar', 'teacher', 'parent'];

function PasswordNotice({ r }: { r: UserResult }) {
  return (
    <div className={`notice ${r.ok ? 'notice-ok' : 'notice-err'}`} role="status">
      {r.message}
      {r.password && (
        <div style={{ marginTop: 8, fontWeight: 500 }}>
          {r.email && <>Barua pepe: <b>{r.email}</b><br /></>}
          Nenosiri la muda: <b style={{ fontSize: 17, letterSpacing: '.04em' }}>{r.password}</b><br />
          <small>Mpe mtumiaji sasa hivi. Halitaonyeshwa tena.</small>
        </div>
      )}
    </div>
  );
}

function ClassPicker({ classes, name, selected, onChange }: { classes: Cls[]; name?: string; selected: string[]; onChange?: (ids: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {classes.map((c) => {
        const on = selected.includes(c.id);
        return (
          <label key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: `2px solid ${on ? 'var(--balewa-orange)' : 'var(--line)'}`, background: on ? 'var(--orange-soft)' : 'var(--surface-card)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            <input type="checkbox" name={name} value={c.id} checked={on}
              onChange={(e) => onChange?.(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />
            {c.name}
          </label>
        );
      })}
    </div>
  );
}

function AddUserForm({ classes }: { classes: Cls[] }) {
  const [state, action, pending] = useActionState<UserResult | null, FormData>(createUser, null);
  const [role, setRole] = useState<Role>('teacher');
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <section className="panel">
      <h2>Ongeza mtumiaji</h2>
      <form action={action} style={{ display: 'grid', gap: 'var(--space-4)' }} key={state?.password ?? 'form'}>
        <div className="form-grid">
          <TextField label="Jina kamili" name="full_name" required />
          <TextField label="Barua pepe (ya kuingia)" name="email" type="email" required />
          <TextField label="Simu" name="phone" type="tel" placeholder="0712 964 348" hint={role === 'parent' ? 'Lazima iwe namba aliyoandikishwa nayo mtoto' : undefined} />
          <SelectField label="Jukumu" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}
            options={ORDER.map((r) => ({ value: r, label: ROLE_SW[r] }))} />
        </div>
        {role === 'teacher' && (
          <div className="bw-field">
            <span className="bw-field-label">Madarasa anayofundisha</span>
            <ClassPicker classes={classes} name="class_ids" selected={picked} onChange={setPicked} />
          </div>
        )}
        <div><Button type="submit" disabled={pending}>{pending ? 'Inaunda…' : 'Unda akaunti'}</Button></div>
      </form>
      {state && <div style={{ marginTop: 'var(--space-4)' }}><PasswordNotice r={state} /></div>}
    </section>
  );
}

function UserRowView({ u, classes }: { u: UserRow; classes: Cls[] }) {
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState(u.classIds);
  const [res, setRes] = useState<UserResult | null>(null);
  const [pending, start] = useTransition();
  const names = classes.filter((c) => u.classIds.includes(c.id));
  return (
    <>
      <tr style={{ opacity: u.active ? 1 : 0.55 }}>
        <td><b>{u.fullName}</b>{u.isMe && <small style={{ color: 'var(--ink-muted)' }}> (wewe)</small>}<br /><small style={{ color: 'var(--ink-muted)' }}>{u.email}</small></td>
        <td>{u.phone}</td>
        <td>
          {u.role === 'teacher'
            ? (names.length ? <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{names.map((c) => <LevelTag key={c.id} level={c.level}>{c.name}</LevelTag>)}</span>
              : <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>Hajapangiwa darasa</span>)
            : <span style={{ color: 'var(--ink-muted)' }}>—</span>}
        </td>
        <td>{u.active ? 'Hai' : <b style={{ color: 'var(--danger)' }}>Imezimwa</b>}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {u.role === 'teacher' && <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>Madarasa</Button>}{' '}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setRes(await resetPassword(u.id)))}>Nenosiri jipya</Button>{' '}
          {!u.isMe && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setRes(await setActive(u.id, !u.active)))}>{u.active ? 'Zima' : 'Washa'}</Button>}
        </td>
      </tr>
      {(editing || res) && (
        <tr><td colSpan={5} style={{ background: 'var(--surface)' }}>
          {editing && (
            <div style={{ display: 'grid', gap: 12, padding: '8px 0' }}>
              <ClassPicker classes={classes} selected={sel} onChange={setSel} />
              <div><Button size="sm" disabled={pending} onClick={() => start(async () => { setRes(await setTeacherClasses(u.id, sel)); setEditing(false); })}>Hifadhi madarasa</Button></div>
            </div>
          )}
          {res && <PasswordNotice r={res} />}
        </td></tr>
      )}
    </>
  );
}

export function UsersManager({ users, classes }: { users: UserRow[]; classes: Cls[] }) {
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const shown = users.filter((u) => filter === 'all' || u.role === filter);
  const unassigned = users.filter((u) => u.role === 'teacher' && u.active && !u.classIds.length).length;
  return (
    <>
      <AddUserForm classes={classes} />
      {unassigned > 0 && <p className="notice" style={{ background: 'var(--sun)', color: 'var(--ink)' }}>Walimu {unassigned} hawajapangiwa darasa. Hawataona mwanafunzi yeyote mpaka wapangiwe.</p>}
      <section className="panel" style={{ overflowX: 'auto' }}>
        <div className="filters" style={{ marginBottom: 'var(--space-4)' }}>
          {(['all', ...ORDER] as const).map((r) => (
            <Button key={r} size="sm" variant={filter === r ? 'primary' : 'outline'} onClick={() => setFilter(r)}>
              {r === 'all' ? `Wote (${users.length})` : `${ROLE_SW[r]} (${users.filter((u) => u.role === r).length})`}
            </Button>
          ))}
        </div>
        <table className="table">
          <thead><tr><th>Jina</th><th>Simu</th><th>Madarasa</th><th>Hali</th><th></th></tr></thead>
          <tbody>{shown.map((u) => <UserRowView key={u.id} u={u} classes={classes} />)}</tbody>
        </table>
        {!shown.length && <p className="empty">Hakuna mtumiaji.</p>}
      </section>
    </>
  );
}
