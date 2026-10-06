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
