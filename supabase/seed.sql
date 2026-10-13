-- Seed: Balewa Nursery & Primary School, classes, current term and fee items.
-- Fees below are PLACEHOLDERS: replace with the school's real amounts.
-- Users are created in Supabase Auth first, then given a profile (see README).

insert into schools (id, name, slug, reg_no, phone, address, motto, sms_sender_id)
values ('00000000-0000-0000-0000-000000000001', 'Balewa Nursery & Primary School', 'balewa',
        'EM. 21392', '+255712964348', 'Kibamba, Mng''ongoni, Dar es Salaam', 'Dedicated to Excellence', 'BALEWA');

insert into terms (school_id, year, name, starts_on, ends_on, is_current) values
('00000000-0000-0000-0000-000000000001', 2026, 'Muhula wa 3', '2026-09-07', '2026-12-04', true);

insert into classes (school_id, name, level, sort_order) values
('00000000-0000-0000-0000-000000000001', 'Day Care', 'daycare', 1),
('00000000-0000-0000-0000-000000000001', 'Baby Class', 'nursery', 2),
('00000000-0000-0000-0000-000000000001', 'Middle Class', 'nursery', 3),
('00000000-0000-0000-0000-000000000001', 'Top Class', 'nursery', 4),
('00000000-0000-0000-0000-000000000001', 'Std 1', 'primary', 5),
('00000000-0000-0000-0000-000000000001', 'Std 2', 'primary', 6),
('00000000-0000-0000-0000-000000000001', 'Std 3', 'primary', 7),
('00000000-0000-0000-0000-000000000001', 'Std 4', 'primary', 8),
('00000000-0000-0000-0000-000000000001', 'Std 5', 'primary', 9),
('00000000-0000-0000-0000-000000000001', 'Std 6', 'primary', 10),
('00000000-0000-0000-0000-000000000001', 'Std 7', 'primary', 11);

insert into fee_items (school_id, term_id, level, name, amount)
select '00000000-0000-0000-0000-000000000001', t.id, l.level, 'Ada ya muhula', l.amount
from terms t, (values ('daycare'::school_level, 360000), ('nursery', 380000), ('primary', 450000)) as l(level, amount)
where t.school_id = '00000000-0000-0000-0000-000000000001' and t.is_current;
