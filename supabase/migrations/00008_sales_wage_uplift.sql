-- 00008_sales_wage_uplift.sql
-- Pullens Admin: NMW-compliant wage uplift for 44h sales staff
-- Effective: Monday 18 May 2026 (apply AFTER 11-15 May payroll run is finalised)
-- Refs spec: docs/superpowers/specs/2026-05-14-payroll-engine-ot-and-sales-rate-design.md

BEGIN;

UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT012'; -- Nicolette
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT023'; -- Faith
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT024'; -- Gugu
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT032'; -- Zandile

-- Audit trail
INSERT INTO audit_log (action, entity_type, entity_id, after_state)
SELECT
  'wage_uplift_nmw_2026_05_18',
  'employee',
  id,
  jsonb_build_object('pt_code', pt_code, 'new_weekly_wage', 1340.00, 'effective', '2026-05-18')
FROM employees
WHERE pt_code IN ('PT012','PT023','PT024','PT032');

COMMIT;
