-- Pullens Admin: Add Pinetown site, reassign Fika/Randhir/Gugu
-- Migration 00011 (22 May 2026)
--
-- Background: Pullens operates from PMB (Allandale) + Pinetown. The 00010
-- migration missed Pinetown. Three staff are based there:
--   PT028 Randhir Singh (was set to 'durban' in 00010 — wrong)
--   PT024 Gugulethu Cele (was set to 'durban' in 00010 — wrong)
--   PT029 Fika Jabulani Mdlalose (was default 'allandale' — wrong)
--
-- Fika was earmarked for enrolment at the Allandale device with code 9038.
-- He's not at Allandale, so we null his biometric_id (he'll be enrolled at
-- Pinetown when that device arrives).

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_site_check;
ALTER TABLE employees
  ADD CONSTRAINT employees_site_check
  CHECK (site IN ('allandale', 'pinetown', 'durban', 'church_street', 'ladysmith'));

UPDATE employees SET site = 'pinetown' WHERE pt_code IN ('PT024', 'PT028', 'PT029');

-- Fika's pre-assigned Allandale code becomes invalid; clear it.
UPDATE employees SET biometric_id = NULL WHERE pt_code = 'PT029';

INSERT INTO audit_log (action, entity_type, entity_id, after_state) VALUES (
  'schema_migration',
  'system',
  NULL,
  jsonb_build_object(
    'migration', '00011_pinetown_site',
    'summary', 'Added pinetown to site check constraint. Reassigned PT024 Gugu, PT028 Randhir, PT029 Fika to pinetown. Cleared Fika''s biometric_id (was 9038, pre-assigned for Allandale enrolment).'
  )
);
