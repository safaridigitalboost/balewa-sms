export const tsh = (n: number | string | null | undefined) =>
  'TSh ' + Math.round(Number(n) || 0).toLocaleString('en-US');

export const tshShort = (n: number) =>
  n >= 1_000_000 ? `TSh ${(n / 1_000_000).toFixed(1)}M` : tsh(n);

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];

export const dateSw = (d: string | Date) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
};
export const dayDateSw = (d: Date) => `${DAYS[d.getDay()]}, ${dateSw(d)}`;

/** Today's date in Tanzania (UTC+3) as YYYY-MM-DD. */
export const todayTZ = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

/** Normalise 0712..., 712..., +255712... to +255712... */
export function normalisePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '');
  const m = d.match(/^(?:\+?255|0)?([67]\d{8})$/);
  return m ? `+255${m[1]}` : null;
}
