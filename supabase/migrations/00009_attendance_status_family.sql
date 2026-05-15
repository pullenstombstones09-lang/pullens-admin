-- 00009_attendance_status_family.sql
-- Pullens Admin: add 'family' to attendance_status enum
-- Date: 2026-05-15
-- Refs spec: docs/superpowers/specs/2026-05-15-frl-and-friday-ot-permission-design.md

ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'family';
