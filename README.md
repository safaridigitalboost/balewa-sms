# Balewa Schools — School Management System

Next.js 15 + Supabase. Phase 1: login by role, student enrolment, fees (invoices and payments), daily attendance, SMS queue, and a dashboard. Built multi-school from day one: each school's data is isolated by Row Level Security, so the same system can serve other schools later.

## What's inside

| Path | What |
|---|---|
| `supabase/migrations/0001_init.sql` | Database: schools, profiles (roles), terms, classes, students, guardians, fee items, invoices, payments, attendance, SMS log, and every security rule |
| `supabase/seed.sql` | Balewa school, 11 classes, current term, **placeholder** fees |
| `app/login` | Sign-in |
| `app/(app)/dashboard` | Head teacher / bursar overview; parents see their children's fees |
| `app/(app)/students` | Student list, search, and enrolment form (`/students/new`) |
| `app/(app)/fees` | Term balances and recording payments |
| `app/(app)/attendance` | One-tap attendance for teachers; queues SMS to parents of absent children |
| `components/ui` | Balewa design-system components (Button, StatusBadge, LevelTag, TextField, StatCard, FeeCard) |
| `app/globals.css` | Design tokens (colours, spacing, radius) from the Balewa design system |

## Who can do what (enforced in the database)

| | Admin (head teacher) | Bursar | Teacher | Parent |
|---|---|---|---|---|
| Students | add / edit | add / edit | view | own children only |
| Fees & payments | full | full | — | own children only |
| Attendance | mark | — | mark (own classes only) | own children only |
| Students & parents (view) | all | all | own classes only | own children only |
| Users & class assignments | manage | — | — | — |
| Other schools' data | — | — | — | — |

## Setup (about 20 minutes)

1. **Create a Supabase project** at supabase.com (pick the region closest to Tanzania, e.g. EU Central or South Africa if offered).
2. **Run the database:** Supabase → SQL Editor → paste and run, in order: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `supabase/migrations/0002_users_and_class_teachers.sql`.
3. **Set the real fees:** edit the `fee_items` rows (Table Editor) with Balewa's actual amounts.
4. **Create the starter logins:** add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Settings → API), then run `node scripts/create-users.mjs`. It creates one login per role and a demo student (Neema, Std 4) linked to the parent:

   | Role | Email | Password |
   |---|---|---|
   | Admin (head teacher) | mkuu@balewa.test | Balewa-Admin-2026 |
   | Bursar | mhasibu@balewa.test | Balewa-Bursar-2026 |
   | Teacher (Std 4) | mwalimu@balewa.test | Balewa-Teacher-2026 |
   | Parent | mzazi@balewa.test | Balewa-Parent-2026 |

   **Change these passwords before real use.** For real staff later: Authentication → Users → Add user, then insert a `profiles` row with their role.
5. **Run locally:**
   ```bash
   cp .env.example .env.local   # paste your Supabase URL, anon key and service role key
   npm install
   node scripts/create-users.mjs
   node scripts/seed-demo.mjs   # optional: demo data for every screen
   npm run dev                  # http://localhost:3000
   ```
6. **Go live:** push to GitHub → import into Vercel → add the three environment variables → Deploy. `SUPABASE_SERVICE_ROLE_KEY` is needed by the server for the Users page: add it as a normal (server) variable on Vercel, never with a `NEXT_PUBLIC_` prefix, and never commit it.

## Demo data

`node scripts/seed-demo.mjs` fills the system so every screen has something to show: 86 students across all 11 classes, 69 guardians (some siblings share a parent), term invoices, payments in every state (paid, part paid, unpaid) through M-Pesa, Mixx, Airtel, bank and cash, 10 school days of attendance (today left unmarked for Std 3 and Middle Class so the dashboard reminder shows), and an SMS log.

- Run it again to rebuild the same demo. Remove it with `node scripts/seed-demo.mjs --remove`.
- Demo records use guardian phones starting `+25570000`; real records are never touched.

## Importing data (Import page)

Admin and bursar get an **Import** tab. Upload a CSV saved from Excel (File → Save As → CSV UTF-8) or Google Sheets. Each import shows a row-by-row preview with errors before anything is saved, and the server checks every row again.

| Import | Columns | What it does |
|---|---|---|
| Students & guardians | first_name, middle_name, last_name, gender, date_of_birth, class, guardian_name, guardian_phone, relationship, previous_school | Creates students with registration numbers, links siblings to one guardian by phone, skips students already registered in the same class, and bills the current term |
| Fee payments | reg_no, amount, method, reference, paid_on | Adds payments to the current term's invoice. Skips repeated transaction references, unknown students and fully paid invoices, and flags overpayments |

Templates download from the page. Test files are in `samples/` (they include a few bad rows on purpose so you can see the error messages).

## Users and teacher classes (Watumiaji page)

The head teacher (admin) gets a **Watumiaji** tab:

- **Add a user:** name, login email, phone and role (admin, bursar, teacher, parent). The system creates a temporary password and shows it **once**, so hand it over straight away.
- **Teachers see only their classes.** Pick classes when adding a teacher, or later with **Madarasa**. A teacher with no class sees no pupils. This is enforced in the database (migration 0002), not just hidden in the screens: a teacher cannot read or mark pupils from another class.
- **Parents** are linked to their children automatically by the phone number used when the child was enrolled.
- **Nenosiri jipya** creates a new temporary password. **Zima** switches an account off: it can no longer sign in or read any data. **Washa** turns it back on.

## Parent logins

Create the parent's auth user and a `profiles` row with role `parent`, then link it to their guardian record:
```sql
update guardians set profile_id = '<parent-user-id>' where phone = '+255712964348';
```
They will then see only their own children.

## Not built yet (next steps)

- **SMS sending:** messages are saved in `sms_messages` with status `queued`. Next: a small worker (Supabase Edge Function or Vercel cron) that sends them through Beem Africa or NextSMS.
- **Control numbers and mobile payments:** `invoices.control_number` is ready. Next: connect Selcom, AzamPay or ClickPesa, and record payments automatically from their callback.
- **Phone-number login** for parents (Supabase phone OTP).
- Phase 2 screens from the design system: marks entry, report cards (primary and nursery), timetable.

## Checks done

- `next build` passes (TypeScript strict).
- The schema was run on Postgres with tests confirming: teachers cannot add students or see fees; parents see only their own child and cannot mark attendance; another school sees nothing and cannot write into Balewa's data; payments update the invoice status automatically (unpaid → partial → paid).
