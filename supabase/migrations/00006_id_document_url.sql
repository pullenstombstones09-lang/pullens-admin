-- Add id_document_url column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_document_url TEXT;
