-- Migration: add context jsonb column to project table
-- Run this against your Supabase/PostgreSQL database if the column doesn't exist yet.

ALTER TABLE project ADD COLUMN IF NOT EXISTS context jsonb;
