-- Pullens Admin: Seed public holidays (2026-2028) and default settings
-- Migration 00004

-- ============================================================
-- SA PUBLIC HOLIDAYS 2026
-- ============================================================
INSERT INTO public_holidays (date, name) VALUES
  ('2026-01-01', 'New Year''s Day'),
  ('2026-03-21', 'Human Rights Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Family Day'),
  ('2026-04-27', 'Freedom Day'),
  ('2026-05-01', 'Workers'' Day'),
  ('2026-06-16', 'Youth Day'),
  ('2026-08-09', 'National Women''s Day'),
  ('2026-08-10', 'National Women''s Day (observed)'),
  ('2026-09-24', 'Heritage Day'),
  ('2026-12-16', 'Day of Reconciliation'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-26', 'Day of Goodwill');

-- ============================================================
-- SA PUBLIC HOLIDAYS 2027
-- ============================================================
INSERT INTO public_holidays (date, name) VALUES
  ('2027-01-01', 'New Year''s Day'),
  ('2027-03-21', 'Human Rights Day'),
  ('2027-03-22', 'Human Rights Day (observed)'),
  ('2027-03-26', 'Good Friday'),
  ('2027-03-29', 'Family Day'),
  ('2027-04-27', 'Freedom Day'),
  ('2027-05-01', 'Workers'' Day'),
  ('2027-06-16', 'Youth Day'),
  ('2027-08-09', 'National Women''s Day'),
  ('2027-09-24', 'Heritage Day'),
  ('2027-12-16', 'Day of Reconciliation'),
  ('2027-12-25', 'Christmas Day'),
  ('2027-12-26', 'Day of Goodwill'),
  ('2027-12-27', 'Day of Goodwill (observed)');

-- ============================================================
-- SA PUBLIC HOLIDAYS 2028
-- ============================================================
INSERT INTO public_holidays (date, name) VALUES
  ('2028-01-01', 'New Year''s Day'),
  ('2028-03-21', 'Human Rights Day'),
  ('2028-04-14', 'Good Friday'),
  ('2028-04-17', 'Family Day'),
  ('2028-04-27', 'Freedom Day'),
  ('2028-05-01', 'Workers'' Day'),
  ('2028-06-16', 'Youth Day'),
  ('2028-08-09', 'National Women''s Day'),
  ('2028-09-24', 'Heritage Day'),
  ('2028-09-25', 'Heritage Day (observed)'),
  ('2028-12-16', 'Day of Reconciliation'),
  ('2028-12-25', 'Christmas Day'),
  ('2028-12-26', 'Day of Goodwill');

-- ============================================================
-- DEFAULT SETTINGS
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('company_name', '"Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones"'),
  ('company_reg', '"2011/105461/23"'),
  ('company_coid', '"990001280518"'),
  ('company_uif_ref', '"2573997/9"'),
  ('company_address', '"Pietermaritzburg, KwaZulu-Natal"'),
  ('company_phone', '""'),
  ('company_tax_ref', '""'),
  ('nmw_hourly_rate', '30.23'),
  ('nmw_weekly_minimum', '1209.20'),
  ('uif_rate', '0.01'),
  ('uif_ceiling_monthly', '17712.00'),
  ('uif_ceiling_weekly', '4428.00'),
  ('ordinary_hours_per_week', '40'),
  ('ot_multiplier_weekday', '1.5'),
  ('ot_multiplier_sunday_ph', '2.0'),
  ('late_grace_minutes', '5'),
  ('late_tier_1_end_minutes', '30'),
  ('late_tier_1_dock_minutes', '30'),
  ('late_tier_2_end_minutes', '60'),
  ('late_tier_2_dock_minutes', '60'),
  ('pay_cycle_start_day', '"friday"'),
  ('pay_cycle_end_day', '"thursday"'),
  ('petty_cash_cutoff_day', '"thursday"'),
  ('petty_cash_cutoff_hour', '16'),
  ('work_start_time', '"08:00"'),
  ('work_end_time_mon_thu', '"17:00"'),
  ('work_end_time_fri', '"16:00"'),
  ('lunch_break_minutes', '30'),
  ('tea_break_minutes', '15');
