#!/bin/sh
set -e

APP_USER="${POSTGRES_APP_USER:-vaultrag_user}"
APP_PASSWORD="${POSTGRES_APP_PASSWORD:-vaultrag_secure_password_dev}"
DB_NAME="${POSTGRES_DB:-vaultrag_db}"
ADMIN_USER="${POSTGRES_USER:-vaultrag_admin}"

echo "=========================================================="
echo " [VaultRAG] Initializing PostgreSQL Extensions and Roles"
echo " Target Database: $DB_NAME"
echo " Application Role: $APP_USER (NOSUPERUSER, NOBYPASSRLS)"
echo "=========================================================="

psql -v ON_ERROR_STOP=1 --username "$ADMIN_USER" --dbname "$DB_NAME" \
     -v app_user="$APP_USER" \
     -v app_pass="$APP_PASSWORD" \
     -v db_name="$DB_NAME" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "vector";

    -- Create application non-superuser role if missing
    SELECT format(
        'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS CREATEDB',
        :'app_user',
        :'app_pass'
    )
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
    ) \gexec

    -- Update password and ensure NOSUPERUSER NOBYPASSRLS if role exists
    SELECT format(
        'ALTER ROLE %I WITH PASSWORD %L NOSUPERUSER NOBYPASSRLS CREATEDB',
        :'app_user',
        :'app_pass'
    )
    WHERE EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
    ) \gexec

    -- Ensure legacy or alternate container role cannot bypass RLS
    SELECT format(
        'ALTER ROLE %I WITH NOSUPERUSER NOBYPASSRLS',
        'vaultrag_app'
    )
    WHERE EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'vaultrag_app'
    ) \gexec

    -- Grant database and schema privileges
    SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'db_name', :'app_user') \gexec
    SELECT format('GRANT ALL ON SCHEMA public TO %I', :'app_user') \gexec
    SELECT format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', :'app_user') \gexec
    SELECT format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_user') \gexec
    SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %I', :'app_user') \gexec
    SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %I', :'app_user') \gexec
EOSQL

echo "[VaultRAG] Database initialization completed successfully."

