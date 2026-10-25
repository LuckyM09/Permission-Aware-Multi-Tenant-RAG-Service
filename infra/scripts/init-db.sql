-- Initialize PostgreSQL Extensions for VaultRAG
-- This script runs once during container initialization

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Verify vector extension is loaded
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        RAISE NOTICE 'pgvector extension successfully initialized.';
    ELSE
        RAISE EXCEPTION 'Failed to initialize pgvector extension.';
    END IF;
END $$;

-- Create application non-superuser role for Row-Level Security (RLS) enforcement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaultrag_user') THEN
        CREATE ROLE vaultrag_user WITH LOGIN PASSWORD 'vaultrag_secure_password_dev' CREATEDB;
        GRANT ALL PRIVILEGES ON DATABASE vaultrag_db TO vaultrag_user;
        GRANT ALL ON SCHEMA public TO vaultrag_user;
        GRANT vaultrag_user TO vaultrag_app;
    END IF;
END $$;
